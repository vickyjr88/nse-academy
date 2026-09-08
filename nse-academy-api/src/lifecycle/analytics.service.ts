import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LIFECYCLE_FLOWS, LifecycleFlow } from './lifecycle.service';

export interface FlowSummary {
  flow: LifecycleFlow;
  entered: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  opened: number;
  clicked: number;
}

export interface FunnelStageCount {
  stage: string;
  count: number;
}

export interface DailyFlowVolume {
  date: string; // YYYY-MM-DD
  flow: LifecycleFlow;
  entered: number;
  sent: number;
}

/**
 * Read-only aggregation over FlowEntry + BroadcastCampaign for the admin
 * dashboard - the funnel chart, per-flow health, and campaign send history.
 * Kept separate from LifecycleService (which owns writes/mutations) since
 * this is a distinct concern: reporting never mutates anything, and giving
 * it its own service means a slow or wrong report query can never affect
 * whether an email actually sends.
 */
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Per-flow totals broken down by outcome, over an optional date range.
   * This is the raw material for both the "flow health" table and the
   * funnel bars - each flow's `entered` count is one bar segment.
   */
  async getFlowSummaries(since?: Date): Promise<FlowSummary[]> {
    const where = since ? { enteredAt: { gte: since } } : {};
    const [grouped, openedGrouped, clickedGrouped] = await Promise.all([
      this.prisma.flowEntry.groupBy({ by: ['flow', 'outcome'], where, _count: { _all: true } }),
      // opened/clicked are independent timestamps on top of a 'sent' row,
      // not their own outcome value, so they need their own grouped counts
      // rather than falling out of the outcome breakdown above.
      this.prisma.flowEntry.groupBy({ by: ['flow'], where: { ...where, openedAt: { not: null } }, _count: { _all: true } }),
      this.prisma.flowEntry.groupBy({ by: ['flow'], where: { ...where, clickedAt: { not: null } }, _count: { _all: true } }),
    ]);

    const summaries = new Map<LifecycleFlow, FlowSummary>();
    for (const flow of LIFECYCLE_FLOWS) {
      summaries.set(flow, { flow, entered: 0, sent: 0, failed: 0, pending: 0, skipped: 0, opened: 0, clicked: 0 });
    }
    for (const row of grouped) {
      const flow = row.flow as LifecycleFlow;
      const summary = summaries.get(flow);
      if (!summary) continue; // an unrecognized flow value shouldn't crash the dashboard
      const count = row._count._all;
      summary.entered += count;
      if (row.outcome === 'sent') summary.sent += count;
      else if (row.outcome === 'failed') summary.failed += count;
      else if (row.outcome === 'pending') summary.pending += count;
      else if (row.outcome === 'skipped') summary.skipped += count;
    }
    for (const row of openedGrouped) {
      const summary = summaries.get(row.flow as LifecycleFlow);
      if (summary) summary.opened = row._count._all;
    }
    for (const row of clickedGrouped) {
      const summary = summaries.get(row.flow as LifecycleFlow);
      if (summary) summary.clicked = row._count._all;
    }
    return Array.from(summaries.values());
  }

  /**
   * The signup-nurture funnel specifically (day1 -> day7 -> day14 -> paid),
   * as one strictly-decreasing sequence of counts - this is what the funnel
   * chart on the dashboard actually renders. Each stage after "Signed up"
   * counts DISTINCT users who ever entered that flow with outcome='sent',
   * not total sends, so a user re-entering (which shouldn't happen given
   * the sentAt dedupe, but the query doesn't assume it) isn't double-counted.
   */
  async getSignupFunnel(): Promise<FunnelStageCount[]> {
    const [totalUsers, day1, day7, day14, day14Clicked, engaged, paid] = await Promise.all([
      this.prisma.user.count(),
      this.countDistinctUsersSent('day1-nurture'),
      this.countDistinctUsersSent('day7-nurture'),
      this.countDistinctUsersSent('day14-nurture'),
      // Broken out separately from "sent" since this is the pitch email -
      // the gap between "sent" and "clicked" here is the most actionable
      // number in the whole funnel: people who got the direct Intermediary
      // ask and did nothing with it.
      this.countDistinctUsersSent('day14-nurture', { clickedAt: { not: null } }),
      this.countDistinctUsersSent('engaged-free-tagging'),
      this.prisma.subscription.count({ where: { tier: { in: ['intermediary', 'premium'] }, status: 'active' } }),
    ]);

    return [
      { stage: 'Signed up', count: totalUsers },
      { stage: 'Day 1 email sent', count: day1 },
      { stage: 'Day 7 email sent', count: day7 },
      { stage: 'Day 14 pitch sent', count: day14 },
      { stage: 'Day 14 pitch clicked', count: day14Clicked },
      { stage: 'Tagged engaged-free', count: engaged },
      { stage: 'Converted to paid', count: paid },
    ];
  }

  private async countDistinctUsersSent(
    flow: LifecycleFlow,
    extraWhere: Record<string, unknown> = {},
  ): Promise<number> {
    const rows = await this.prisma.flowEntry.findMany({
      where: { flow, outcome: 'sent', ...extraWhere },
      distinct: ['userId'],
      select: { userId: true },
    });
    return rows.length;
  }

  /**
   * The churn-recovery side of the funnel, kept separate from the signup
   * funnel above since it's a different population (people who WERE paying
   * and lapsed) rather than a continuation of the signup sequence.
   */
  async getChurnRecoveryFunnel(): Promise<FunnelStageCount[]> {
    const [lapsed, renewalNudge, winback, reactivated] = await Promise.all([
      this.prisma.subscription.count({ where: { tier: 'free', status: 'cancelled' } }),
      this.countDistinctUsersSent('renewal-nudge'),
      this.countDistinctUsersSent('winback'),
      // A reactivation clears winbackSentAt/renewalNudgeSentAt back to null
      // on renewal (see PaymentsService), so "currently active AND has a
      // FlowEntry for winback or renewal-nudge in their history" identifies
      // someone who lapsed, got a recovery email, and came back - the flags
      // themselves can't show this since they're cleared on success.
      this.prisma.user.count({
        where: {
          subscription: { status: 'active', tier: { in: ['intermediary', 'premium'] } },
          flowEntries: { some: { flow: { in: ['renewal-nudge', 'winback'] }, outcome: 'sent' } },
        },
      }),
    ]);

    return [
      { stage: 'Lapsed to free', count: lapsed },
      { stage: 'Renewal nudge sent (day 5)', count: renewalNudge },
      { stage: 'Win-back sent (day 7)', count: winback },
      { stage: 'Reactivated after recovery email', count: reactivated },
    ];
  }

  /**
   * Daily entered/sent counts per flow for the last N days, for a
   * time-series view alongside the funnel snapshot - lets you see whether
   * a flow's volume is steady, growing, or has gone quiet (e.g. the cron
   * stopped running).
   */
  async getDailyVolume(days = 30): Promise<DailyFlowVolume[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days);

    const entries = await this.prisma.flowEntry.findMany({
      where: { enteredAt: { gte: since } },
      select: { flow: true, enteredAt: true, outcome: true },
    });

    const buckets = new Map<string, DailyFlowVolume>();
    for (const entry of entries) {
      const date = entry.enteredAt.toISOString().slice(0, 10);
      const flow = entry.flow as LifecycleFlow;
      const key = `${date}:${flow}`;
      if (!buckets.has(key)) {
        buckets.set(key, { date, flow, entered: 0, sent: 0 });
      }
      const bucket = buckets.get(key)!;
      bucket.entered++;
      if (entry.outcome === 'sent') bucket.sent++;
    }
    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Campaign-level reporting for the one-shot admin broadcasts - separate
   * from the flow funnel since a broadcast isn't a per-user lifecycle
   * event, it's a single send-to-many-at-once action.
   */
  async getCampaignReport() {
    const campaigns = await this.prisma.broadcastCampaign.findMany({ orderBy: { createdAt: 'desc' } });
    const totalSent = campaigns.reduce((sum, c) => sum + c.audienceCount, 0);
    const totalFailed = campaigns.reduce((sum, c) => sum + c.failedCount, 0);
    return {
      totalCampaigns: campaigns.length,
      totalSent,
      totalFailed,
      failureRate: totalSent > 0 ? totalFailed / (totalSent + totalFailed) : 0,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        subject: c.subject,
        tier: c.tier,
        audienceCount: c.audienceCount,
        failedCount: c.failedCount,
        createdAt: c.createdAt,
      })),
    };
  }
}

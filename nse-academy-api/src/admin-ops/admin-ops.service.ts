import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiUsageService } from '../monitoring/ai-usage.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { SystemHealthService } from '../reports/system-health.service';
import { paymentAmountKes } from '../reports/business-metrics.service';
import { eatDayBounds } from '../reports/report-helpers';
import { MarketFactsService } from '../market-report/market-facts.service';

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

/** Read-side views the admin needs to run the whole system: money, subscriptions, reports, support and system health. */
@Injectable()
export class AdminOpsService {
  constructor(
    private prisma: PrismaService,
    private jobs: JobMonitorService,
    private aiUsage: AiUsageService,
    private health: SystemHealthService,
    private facts: MarketFactsService,
  ) {}

  /** The payment ledger, newest first, with who paid and what it was worth. */
  async payments(page = 1, limit = 25) {
    const take = clamp(limit, 1, 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const [rows, total, byPlan] = await Promise.all([
      this.prisma.processedPayment.findMany({ orderBy: { appliedAt: 'desc' }, skip, take }),
      this.prisma.processedPayment.count(),
      this.prisma.processedPayment.groupBy({ by: ['plan', 'months'], _count: true }),
    ]);
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { id: true, name: true, email: true } });
    const who = new Map(users.map((u) => [u.id, u]));
    return {
      data: rows.map((r) => ({
        reference: r.reference,
        userId: r.userId,
        name: who.get(r.userId)?.name ?? null,
        email: who.get(r.userId)?.email ?? null,
        plan: r.plan,
        months: r.months,
        amountKes: paymentAmountKes(r.plan, r.months),
        appliedAt: r.appliedAt,
      })),
      total,
      page: Math.max(page, 1),
      limit: take,
      totalPages: Math.ceil(total / take),
      totalRevenueKes: byPlan.reduce((s, g) => s + paymentAmountKes(g.plan, g.months) * g._count, 0),
    };
  }

  /** Everyone with a subscription row, soonest-to-expire first for active ones. `expiringWithinDays` narrows to renewals due. */
  async subscriptions(filter: { tier?: string; status?: string; expiringWithinDays?: number; page?: number; limit?: number } = {}) {
    const take = clamp(filter.limit ?? 25, 1, 100);
    const page = Math.max(filter.page ?? 1, 1);
    const where: Record<string, unknown> = {};
    if (filter.tier) where.tier = filter.tier;
    if (filter.status) where.status = filter.status;
    if (filter.expiringWithinDays) {
      where.status = 'active';
      where.tier = { in: ['intermediary', 'premium'] };
      where.currentPeriodEnd = { gte: new Date(), lte: new Date(Date.now() + clamp(filter.expiringWithinDays, 1, 365) * 86_400_000) };
    }
    const [rows, total, groups] = await Promise.all([
      this.prisma.subscription.findMany({ where, orderBy: { currentPeriodEnd: 'asc' }, skip: (page - 1) * take, take, include: { user: { select: { id: true, name: true, email: true } } } }),
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.groupBy({ by: ['tier', 'status'], _count: true }),
    ]);
    return {
      data: rows.map((s) => ({
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        tier: s.tier,
        status: s.status,
        currentPeriodEnd: s.currentPeriodEnd,
        daysLeft: s.currentPeriodEnd ? Math.ceil((s.currentPeriodEnd.getTime() - Date.now()) / 86_400_000) : null,
        freeMonths: s.freeMonths,
      })),
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
      summary: groups.map((g) => ({ tier: g.tier, status: g.status, count: g._count })),
    };
  }

  /** Every public market report, including unpublished ones, for the publish / unpublish / regenerate screen. */
  async marketReports(limit = 60) {
    const rows = await this.prisma.marketReport.findMany({ orderBy: { sessionDate: 'desc' }, take: clamp(limit, 1, 200) });
    return rows.map((r) => ({
      sessionDate: r.sessionDate,
      status: r.status,
      aiGenerated: r.aiGenerated,
      aiModel: r.aiModel,
      headline: ((r.story as { headline?: string } | null)?.headline ?? '') as string,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
    }));
  }

  /** A member's portfolio and recent activity, for support: what they hold, what they logged, what failed. */
  async userPortfolio(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, portfolioWatchEnabled: true } });
    if (!user) throw new NotFoundException('User not found');
    const [holdings, trades, dividends, imports, alerts, notifications] = await Promise.all([
      this.prisma.holding.findMany({ where: { userId }, include: { broker: { select: { name: true } } }, orderBy: { ticker: 'asc' } }),
      this.prisma.trade.findMany({ where: { userId }, orderBy: { tradeDate: 'desc' }, take: 25, include: { broker: { select: { name: true } } } }),
      this.prisma.dividend.findMany({ where: { userId }, orderBy: { paymentDate: 'desc' }, take: 15 }),
      this.prisma.statementImport.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      this.prisma.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return {
      user,
      holdings: holdings.map((h) => ({ id: h.id, ticker: h.ticker, broker: h.broker.name, quantity: h.quantity, avgCost: h.avgCost, costSource: h.costSource, updatedAt: h.updatedAt })),
      trades: trades.map((t) => ({ id: t.id, ticker: t.ticker, side: t.side, quantity: t.quantity, pricePerShare: t.pricePerShare, broker: t.broker.name, tradeDate: t.tradeDate, source: t.source })),
      dividends: dividends.map((d) => ({ id: d.id, ticker: d.ticker, amountKes: d.amountKes, paymentDate: d.paymentDate, source: d.source })),
      statementImports: imports.map((i) => ({ id: i.id, filename: i.filename, status: i.status, error: i.error, createdAt: i.createdAt })),
      priceAlerts: alerts.map((a) => ({ id: a.id, ticker: a.ticker, direction: a.direction, targetPrice: a.targetPrice, status: a.status, createdAt: a.createdAt, triggeredAt: a.triggeredAt })),
      notifications: notifications.map((n) => ({ id: n.id, type: n.type, title: n.title, read: n.read, createdAt: n.createdAt })),
    };
  }

  /** Live system status: every scheduled job's verdict, today's price-feed figures, AI usage over the last 7 days. */
  async systemHealth(now = new Date()) {
    const today = eatDayBounds(now, 0);
    const session = await this.facts.latestSessionYmd(now);
    const report = await this.health.build(today, now, session);
    const week = await this.aiUsage.summary(new Date(now.getTime() - 7 * 86_400_000), now);
    return { generatedAt: now, jobs: report.jobs, feed: report.feed, marketReport: report.marketReport, email: report.email, aiToday: report.ai, aiLast7Days: week };
  }

  recentJobRuns(job: string | undefined, limit = 50) {
    return this.jobs.recent(job, limit);
  }

  async aiCalls(feature: string | undefined, limit = 50) {
    const rows = await this.prisma.aiCall.findMany({ where: feature ? { feature } : {}, orderBy: { createdAt: 'desc' }, take: clamp(limit, 1, 200) });
    return rows;
  }
}

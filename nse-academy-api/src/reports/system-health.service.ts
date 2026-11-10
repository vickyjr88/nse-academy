import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoCampaignStats, BrevoEmailStats, BrevoService, BREVO_APP_TAG } from '../brevo/brevo.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { AiUsageService, AiUsageRow } from '../monitoring/ai-usage.service';
import { JobHealth } from '../monitoring/job-specs';
import { DayBounds } from './report-helpers';

/** A weekday's polls: the data plan allows 4 requests an hour and polling runs 09:00-16:00 Nairobi, about 27; fewer snapshots than this means gaps. */
export const EXPECTED_POLLS_PER_DAY = 27;

export interface SystemReport {
  jobs: JobHealth[];
  feed: {
    attempts: number;
    succeeded: number;
    /** e.g. { 'HTTP 429': 21 } - why the failed polls failed. */
    failureReasons: Record<string, number>;
    snapshotsStored: number;
    lastSnapshotAt: string | null;
  };
  marketReport: { sessionYmd: string | null; exists: boolean; status: string | null; aiGenerated: boolean | null; model: string | null };
  ai: { rows: AiUsageRow[]; calls: number; failed: number; unverified: number; costUsd: number };
  email: BrevoEmailStats | null;
  campaigns: BrevoCampaignStats[];
}

@Injectable()
export class SystemHealthService {
  constructor(
    private prisma: PrismaService,
    private jobs: JobMonitorService,
    private aiUsage: AiUsageService,
    private brevo: BrevoService,
  ) {}

  /** `sessionYmd` is the market session the report is about (the market report for it should exist by now). */
  async build(day: DayBounds, now: Date, sessionYmd: string | null): Promise<SystemReport> {
    const [jobs, feed, marketReport, aiRows, email, campaigns] = await Promise.all([
      this.jobs.health(now),
      this.feed(day, now),
      this.marketReport(sessionYmd),
      this.aiUsage.summary(day.start, day.end),
      this.brevo.getEmailStats(day.ymd, day.ymd, BREVO_APP_TAG),
      this.brevo.getCampaignStats(day.start.toISOString(), day.end.toISOString()),
    ]);
    return {
      jobs,
      feed,
      marketReport,
      ai: {
        rows: aiRows,
        calls: aiRows.reduce((n, r) => n + r.calls, 0),
        failed: aiRows.reduce((n, r) => n + r.failed, 0),
        unverified: aiRows.reduce((n, r) => n + r.unverified, 0),
        costUsd: aiRows.reduce((n, r) => n + r.costUsd, 0),
      },
      email: email && email.requests > 0 ? email : null,
      campaigns,
    };
  }

  private async feed(day: DayBounds, now: Date): Promise<SystemReport['feed']> {
    const polls = await this.prisma.jobRun.findMany({ where: { job: 'market-poll', startedAt: { gte: day.start, lt: day.end } }, select: { ok: true, error: true } });
    const failureReasons: Record<string, number> = {};
    for (const p of polls) if (!p.ok) failureReasons[p.error ?? 'unknown'] = (failureReasons[p.error ?? 'unknown'] ?? 0) + 1;
    const [snap] = await this.prisma.$queryRaw<{ n: bigint; last: Date | null }[]>(Prisma.sql`
      select count(distinct "timestamp") as n, max("timestamp") as last from "StockPrice"
      where "timestamp" >= ${day.start} and "timestamp" < ${day.end}`);
    const [latest] = await this.prisma.$queryRaw<{ last: Date | null }[]>(Prisma.sql`select max("timestamp") as last from "StockPrice" where "timestamp" <= ${now}`);
    return {
      attempts: polls.length,
      succeeded: polls.filter((p) => p.ok).length,
      failureReasons,
      snapshotsStored: Number(snap?.n ?? 0),
      lastSnapshotAt: latest?.last ? new Date(latest.last).toISOString() : null,
    };
  }

  private async marketReport(sessionYmd: string | null): Promise<SystemReport['marketReport']> {
    if (!sessionYmd) return { sessionYmd: null, exists: false, status: null, aiGenerated: null, model: null };
    const r = await this.prisma.marketReport.findUnique({ where: { sessionDate: sessionYmd }, select: { status: true, aiGenerated: true, aiModel: true } });
    return { sessionYmd, exists: !!r, status: r?.status ?? null, aiGenerated: r?.aiGenerated ?? null, model: r?.aiModel ?? null };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService, nairobiYmd } from '../activity/activity.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { paymentAmountKes, recurringRevenue } from '../reports/business-metrics.service';

const DAY_MS = 86_400_000;
const EAT_OFFSET_MS = 3 * 3_600_000;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

/** YYYY-MM-DD of a moment in Nairobi (UTC+3, no daylight saving). */
export const eatDay = (d: Date) => new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);

/** Every Nairobi day from `days - 1` days ago up to today, oldest first. */
export function dayRange(now: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) => eatDay(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
}

/** A series with a value for every day in `range` (0 where the data has none). */
export function fillDays<T extends { day: string }>(range: string[], rows: T[], zero: Omit<T, 'day'>): T[] {
  const by = new Map(rows.map((r) => [r.day, r]));
  return range.map((day) => by.get(day) ?? ({ day, ...zero } as T));
}

/** Percentage change from `before` to `now`; null when there is nothing to compare with. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

/** Billing length in months from a Google Play base-plan id such as "monthly", "quarterly", "annual". */
export function monthsFromBasePlan(basePlanId: string | null | undefined): number {
  const id = (basePlanId ?? '').toLowerCase();
  // "semiannual" contains "annual", so the six-month names are checked first.
  if (/(semi|half|6)/.test(id)) return 6;
  if (/(annual|year|12)/.test(id)) return 12;
  if (/(quarter|3)/.test(id)) return 3;
  return 1;
}

export type Severity = 'high' | 'medium' | 'low';
export interface AttentionItem {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  count: number;
  /** A path under the admin plugin, e.g. "members/advisors". */
  route: string | null;
}

/** The latest run of each job, newest runs first in `runs`. A job is failing when its latest finished run did not succeed. */
export function failingJobs(runs: { job: string; ok: boolean; finishedAt: Date | null }[]): string[] {
  const seen = new Set<string>();
  const failing: string[] = [];
  for (const r of runs) {
    if (seen.has(r.job) || !r.finishedAt) continue;
    seen.add(r.job);
    if (!r.ok) failing.push(r.job);
  }
  return failing;
}

export function buildAttention(c: {
  pendingAdvisors: number;
  newContacts: number;
  expiringSoon: number;
  playOnHold: number;
  failedImports: number;
  failingJobs: string[];
  failedAiCalls: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (c.failingJobs.length) items.push({ key: 'jobs', severity: 'high', title: 'Scheduled jobs are failing', detail: c.failingJobs.slice(0, 4).join(', '), count: c.failingJobs.length, route: 'system' });
  if (c.playOnHold) items.push({ key: 'play-hold', severity: 'medium', title: 'Google Play subscriptions on hold or pending', detail: 'A payment did not clear; the member keeps no access until it does', count: c.playOnHold, route: 'revenue' });
  if (c.pendingAdvisors) items.push({ key: 'advisors', severity: 'medium', title: 'Advisers waiting for approval', detail: 'They stay hidden from members until approved', count: c.pendingAdvisors, route: 'members/advisors' });
  if (c.newContacts) items.push({ key: 'contacts', severity: c.newContacts > 5 ? 'high' : 'medium', title: 'Unread contact messages', detail: 'Messages from the contact form nobody has opened', count: c.newContacts, route: 'marketing/inbox' });
  if (c.failedAiCalls) items.push({ key: 'ai', severity: 'low', title: 'AI requests failed in the last 24 hours', detail: 'Stock analysis or the market report may have fallen back', count: c.failedAiCalls, route: 'system' });
  if (c.failedImports) items.push({ key: 'imports', severity: 'low', title: 'CDS statement imports failed this week', detail: 'Members could not seed their portfolio from a PDF', count: c.failedImports, route: null });
  if (c.expiringSoon) items.push({ key: 'expiring', severity: 'low', title: 'Plans ending in the next 7 days', detail: 'A renewal reminder may help', count: c.expiringSoon, route: 'revenue' });
  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

interface SeriesSpec {
  table: string;
  at: string;
  /** Optional extra condition, e.g. completed lessons only. */
  where?: string;
  /** Optional SUM column for a second figure per day (e.g. revenue). */
  sum?: string;
}

/** The daily series a dedicated admin page can chart. Table and column names come from this list only, never from a caller. */
export const SERIES: Record<string, SeriesSpec> = {
  signups: { table: 'User', at: 'createdAt' },
  leads: { table: 'Lead', at: 'createdAt' },
  contacts: { table: 'ContactSubmission', at: 'createdAt' },
  ebooks: { table: 'EbookPurchase', at: 'purchasedAt', sum: 'amountKes' },
  referrals: { table: 'Referral', at: 'createdAt' },
  lessons: { table: 'LessonProgress', at: 'completedAt', where: '"completed" = true AND "completedAt" IS NOT NULL' },
  trades: { table: 'Trade', at: 'createdAt' },
  alerts: { table: 'PriceAlert', at: 'createdAt' },
  questions: { table: 'AdvisorQuery', at: 'createdAt' },
  profiles: { table: 'InvestorProfile', at: 'createdAt' },
  imports: { table: 'StatementImport', at: 'createdAt' },
};

const NAIROBI_DAY = (col: string) => `to_char((("${col}" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi'), 'YYYY-MM-DD')`;

@Injectable()
export class AdminMetricsService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private analytics: AnalyticsService,
  ) {}

  /** A daily count (and optional sum) for one of the metrics in SERIES over the last `days` Nairobi days, with the previous period's total. */
  async series(metric: string, days = 30, now = new Date()) {
    const spec = SERIES[metric];
    if (!spec) return null;
    const n = clamp(days, 7, 365);
    const range = dayRange(now, n);
    const from = new Date(now.getTime() - (n - 1) * DAY_MS - 3 * 3_600_000);
    const prevFrom = new Date(from.getTime() - n * DAY_MS);
    const cond = spec.where ? ` AND ${spec.where}` : '';
    const sum = spec.sum ? `, COALESCE(SUM("${spec.sum}"), 0)::float AS value` : '';
    const rows = await this.prisma.$queryRawUnsafe<{ day: string; count: bigint | number; value?: number }[]>(
      `SELECT ${NAIROBI_DAY(spec.at)} AS day, COUNT(*) AS count${sum} FROM "${spec.table}" WHERE "${spec.at}" >= $1${cond} GROUP BY 1`,
      prevFrom,
    );
    const mapped = rows.map((r) => ({ day: r.day, count: Number(r.count), value: Number(r.value ?? 0) }));
    const current = fillDays(range, mapped.filter((r) => r.day >= range[0]), { count: 0, value: 0 });
    const previous = mapped.filter((r) => r.day < range[0]);
    const total = current.reduce((s, r) => s + r.count, 0);
    const previousTotal = previous.reduce((s, r) => s + r.count, 0);
    return {
      metric,
      days: n,
      total,
      previousTotal,
      change: pctChange(total, previousTotal),
      value: current.reduce((s, r) => s + r.value, 0),
      series: current,
    };
  }

  /** Everything the admin Overview shows, for the last `days` days against the `days` before them. */
  async overview(days = 30, now = new Date()) {
    const n = clamp(days, 7, 365);
    const from = new Date(now.getTime() - n * DAY_MS);
    const prevFrom = new Date(now.getTime() - 2 * n * DAY_MS);
    const in7 = new Date(now.getTime() + 7 * DAY_MS);
    const range = dayRange(now, n);
    const paidTiers = ['intermediary', 'premium'];

    const [
      totalUsers, newUsers, prevNewUsers, paying, webPayments, playRows, churned, prevChurned,
      profiles, pendingAdvisors, newContacts, expiringSoon, playOnHold, failedImports, jobRuns, failedAiCalls,
      members, traffic, recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: from } } }),
      this.prisma.user.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
      this.prisma.subscription.findMany({ where: { status: 'active', tier: { in: paidTiers }, currentPeriodEnd: { gt: now } }, select: { tier: true, source: true } }),
      this.prisma.processedPayment.findMany({ where: { appliedAt: { gte: prevFrom } }, select: { appliedAt: true, plan: true, months: true, userId: true } }),
      this.prisma.playPurchase.findMany({ where: { createdAt: { gte: prevFrom } }, select: { createdAt: true, tier: true, basePlanId: true, userId: true } }),
      this.prisma.subscription.count({ where: { status: 'cancelled', currentPeriodEnd: { gte: from, lte: now } } }),
      this.prisma.subscription.count({ where: { status: 'cancelled', currentPeriodEnd: { gte: prevFrom, lt: from } } }),
      this.prisma.investorProfile.count({ where: { createdAt: { gte: from } } }),
      this.prisma.advisorProfile.count({ where: { approvalStatus: 'pending' } }),
      this.prisma.contactSubmission.count({ where: { status: 'new' } }),
      this.prisma.subscription.count({ where: { status: 'active', tier: { in: paidTiers }, currentPeriodEnd: { gt: now, lte: in7 } } }),
      this.prisma.playPurchase.count({ where: { state: { in: ['ON_HOLD', 'PENDING'] } } }),
      this.prisma.statementImport.count({ where: { status: 'failed', createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } } }),
      this.prisma.jobRun.findMany({ where: { startedAt: { gte: new Date(now.getTime() - 2 * DAY_MS) } }, orderBy: { startedAt: 'desc' }, take: 600, select: { job: true, ok: true, finishedAt: true } }),
      this.prisma.aiCall.count({ where: { ok: false, createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
      this.activity.metrics(nairobiYmd(now)),
      this.analytics.report(n, now),
      this.prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, name: true, createdAt: true } }),
    ]);

    // Money. The web ledger is exact; Google Play shows new subscriptions at list price (Play keeps the real receipts and
    // renewals), so the Play figure is an estimate and is labelled as one.
    const startKey = range[0];
    const webItems = webPayments.map((p) => ({ day: eatDay(p.appliedAt), at: p.appliedAt, kes: paymentAmountKes(p.plan, p.months), userId: p.userId }));
    const playItems = playRows.map((p) => ({ day: eatDay(p.createdAt), at: p.createdAt, kes: paymentAmountKes(p.tier, monthsFromBasePlan(p.basePlanId)), userId: p.userId }));
    const sumKes = (items: { at: Date; kes: number }[], from_: Date, to: Date) => items.filter((i) => i.at >= from_ && i.at < to).reduce((s, i) => s + i.kes, 0);
    const revenueNow = sumKes(webItems, from, new Date(now.getTime() + 1)) + sumKes(playItems, from, new Date(now.getTime() + 1));
    const revenuePrev = sumKes(webItems, prevFrom, from) + sumKes(playItems, prevFrom, from);
    const revenueSeries = range.map((day) => ({
      day,
      web: webItems.filter((i) => i.day === day).reduce((s, i) => s + i.kes, 0),
      play: playItems.filter((i) => i.day === day).reduce((s, i) => s + i.kes, 0),
    }));

    const signupRows = await this.prisma.$queryRawUnsafe<{ day: string; count: bigint | number }[]>(
      `SELECT ${NAIROBI_DAY('createdAt')} AS day, COUNT(*) AS count FROM "User" WHERE "createdAt" >= $1 GROUP BY 1`,
      from,
    );
    const signupSeries = fillDays(range, signupRows.map((r) => ({ day: r.day, count: Number(r.count) })).filter((r) => r.day >= startKey), { count: 0 });

    const count = (t: string) => paying.filter((s) => s.tier === t).length;
    const mrr = recurringRevenue(count('premium'), count('intermediary'));
    const payersInRange = new Set([...webItems, ...playItems].filter((i) => i.at >= from).map((i) => i.userId));
    const failing = failingJobs(jobRuns);

    const feed = [
      ...recentUsers.map((u) => ({ kind: 'signup', title: `${u.name} joined`, at: u.createdAt, route: `members/${u.id}` })),
      ...webItems.filter((i) => i.at >= from).map((i) => ({ kind: 'payment', title: `Payment of KSh ${Math.round(i.kes).toLocaleString('en-KE')}`, at: i.at, route: `members/${i.userId}` })),
      ...playItems.filter((i) => i.at >= from).map((i) => ({ kind: 'play', title: `New Google Play subscription (about KSh ${Math.round(i.kes).toLocaleString('en-KE')})`, at: i.at, route: `members/${i.userId}` })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 10)
      .map((f) => ({ ...f, at: f.at.toISOString() }));

    return {
      generatedAt: now.toISOString(),
      days: n,
      members: {
        total: totalUsers,
        new: newUsers,
        previousNew: prevNewUsers,
        newChange: pctChange(newUsers, prevNewUsers),
        signupSeries,
      },
      active: { dau: members.dau, wau: members.wau, mau: members.mau, stickinessPct: members.stickinessPct, series: members.series, trackingSince: members.trackingSince },
      paying: {
        total: paying.length,
        intermediary: count('intermediary'),
        premium: count('premium'),
        web: paying.filter((s) => s.source !== 'play').length,
        play: paying.filter((s) => s.source === 'play').length,
        churned,
        previousChurned: prevChurned,
      },
      plans: { free: Math.max(totalUsers - paying.length, 0), intermediary: count('intermediary'), premium: count('premium') },
      mrr: { kes: mrr.mrrKes, arrKes: mrr.arrKes },
      revenue: { kes: revenueNow, previousKes: revenuePrev, change: pctChange(revenueNow, revenuePrev), series: revenueSeries, playIsEstimate: true },
      traffic: { visitors: traffic.visitors, previousVisitors: traffic.previous.visitors, pageViews: traffic.pageViews, series: traffic.series },
      funnel: [
        { label: 'Website visitors', value: traffic.visitors },
        { label: 'Signed up', value: newUsers },
        { label: 'Took the investor quiz', value: profiles },
        { label: 'Paid for a plan', value: payersInRange.size },
      ],
      attention: buildAttention({ pendingAdvisors, newContacts, expiringSoon, playOnHold, failedImports, failingJobs: failing, failedAiCalls }),
      feed,
    };
  }
}

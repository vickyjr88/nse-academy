import { Injectable, Logger } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminNotifierService } from '../admin-notifier/admin-notifier.service';
import { escapeHtml } from '../brevo/email-template';
import { attentionBox, dataTable, sectionHeading, signedPct, statRows } from '../brevo/email-blocks';
import { BusinessMetrics, BusinessMetricsService } from './business-metrics.service';
import { SystemHealthService, SystemReport } from './system-health.service';
import { businessAttention, systemAttention } from './bi-rules';
import { biText, businessHtml, kpiStrip, systemHtml } from './bi-render';
import {
  DayBounds,
  MarketSummary,
  Mover,
  PriceRow,
  boundsForYmd,
  computeMovers,
  eatDayBounds,
  formatCompact,
  formatKes,
} from './report-helpers';

export interface DailyReport {
  day: DayBounds;
  market: {
    /** Nairobi date of the session shown - can be earlier than the report day (weekend/holiday). */
    sessionYmd: string | null;
    sessionLabel: string | null;
    isReportDay: boolean;
    /** Weekday with no price snapshots at all - holiday, or the poller is broken. */
    missingData: boolean;
    summary: MarketSummary | null;
  };
  activity: {
    signups: { count: number; recent: { name: string; email: string }[] };
    leads: { captured: number; downloads: number; converted: number };
    ebooks: { count: number; revenueKes: number };
    contact: { count: number; recent: { name: string; subject: string }[] };
    advisors: { applications: number; approved: number; queries: number; alertsSent: number; alertRecipients: number; newClientRequests: number };
    referrals: { created: number; rewarded: number };
    organizations: { created: number; names: string[] };
    priceAlerts: { triggered: number; activeTotal: number };
  };
  subscriptions: {
    activePaid: number;
    premium: number;
    intermediary: number;
    expiredInDay: number;
    expiringSoon: { name: string; email: string; tier: string; endsOn: string }[];
  };
  /** Present when the business-intelligence services are available and did not fail. */
  business?: BusinessMetrics | null;
  system?: SystemReport | null;
  attention: string[];
}

const SOON_DAYS = 7;

@Injectable()
export class DailyReportService {
  private readonly logger = new Logger(DailyReportService.name);

  constructor(
    private prisma: PrismaService,
    private adminNotifier: AdminNotifierService,
    @Optional() private monitor?: JobMonitorService,
    @Optional() private businessMetrics?: BusinessMetricsService,
    @Optional() private systemHealth?: SystemHealthService,
  ) {}

  /** 08:00 Nairobi - covers the whole of the previous Nairobi calendar day. */
  @Cron('0 8 * * *', { timeZone: 'Africa/Nairobi' })
  async handleDailyReport(): Promise<void> {
    try {
      await tracked(this.monitor, 'daily-admin-report', () => this.sendDailyReport(), (r) => `sent to ${r.sentTo.length}`);
      // The price poller writes a row per attempt, so keep the table to a quarter's worth.
      await this.monitor?.prune().catch((e) => this.logger.warn(`Could not prune job runs: ${(e as Error).message}`));
    } catch (err) {
      this.logger.error(`Daily report failed: ${(err as Error).message}`);
    }
  }

  async sendDailyReport(opts: { date?: string; to?: string[] } = {}): Promise<{ date: string; sentTo: string[]; subject: string }> {
    const report = await this.build(opts.date);
    const rendered = this.render(report);
    const sentTo = opts.to?.length ? opts.to : this.adminNotifier.recipients();
    const subject = `${opts.to?.length ? '[TEST] ' : ''}${rendered.subject}`;
    await this.adminNotifier.notify({
      subject,
      eyebrow: 'Daily Report',
      heading: `Daily report - ${report.day.label}`,
      bodyHtml: [rendered.intro],
      rawHtml: rendered.rawHtml,
      bodyText: rendered.text,
      button: { label: 'Open admin', url: this.adminNotifier.adminUrl() },
      to: sentTo,
      tags: ['daily-report'],
    });
    this.logger.log(`Daily report for ${report.day.ymd} sent to ${sentTo.length} recipient(s)`);
    return { date: report.day.ymd, sentTo, subject };
  }

  // ------------------------------------------------------------------ data

  async build(ymd?: string, now = new Date()): Promise<DailyReport> {
    const day = ymd ? boundsForYmd(ymd) : eatDayBounds(now, 1);
    const inDay = { gte: day.start, lt: day.end };
    const soon = new Date(now.getTime() + SOON_DAYS * 24 * 60 * 60 * 1000);

    const [
      market,
      signupCount, signupRecent,
      leadsCaptured, leadDownloads, leadsConverted,
      ebookAgg,
      contactCount, contactRecent, contactUnreadTotal,
      advisorApps, advisorApproved, pendingAdvisors, advisorQueries, advisorAlertAgg, advisorClientReqs,
      referralsCreated, referralsRewarded,
      orgsCreated,
      alertsTriggered, alertsActive,
      tierGroups, expiredInDay, expiringSoon,
    ] = await Promise.all([
      this.buildMarket(day),
      this.prisma.user.count({ where: { createdAt: inDay } }),
      this.prisma.user.findMany({ where: { createdAt: inDay }, orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, email: true } }),
      this.prisma.lead.count({ where: { createdAt: inDay } }),
      this.prisma.lead.count({ where: { downloadedAt: inDay } }),
      this.prisma.lead.count({ where: { convertedAt: inDay } }),
      this.prisma.ebookPurchase.aggregate({ where: { purchasedAt: inDay }, _count: true, _sum: { amountKes: true } }),
      this.prisma.contactSubmission.count({ where: { createdAt: inDay } }),
      this.prisma.contactSubmission.findMany({ where: { createdAt: inDay }, orderBy: { createdAt: 'desc' }, take: 5, select: { name: true, subject: true } }),
      this.prisma.contactSubmission.count({ where: { status: 'new' } }),
      this.prisma.advisorProfile.count({ where: { createdAt: inDay } }),
      this.prisma.advisorProfile.count({ where: { approvedAt: inDay } }),
      this.prisma.advisorProfile.findMany({ where: { approvalStatus: 'pending' }, take: 5, select: { user: { select: { name: true } } } }),
      this.prisma.advisorQuery.count({ where: { createdAt: inDay } }),
      this.prisma.advisorAlert.aggregate({ where: { createdAt: inDay }, _count: true, _sum: { recipientCount: true } }),
      this.prisma.advisorClient.count({ where: { requestedAt: inDay } }),
      this.prisma.referral.count({ where: { createdAt: inDay } }),
      this.prisma.referral.count({ where: { rewardedAt: inDay } }),
      this.prisma.organization.findMany({ where: { createdAt: inDay }, select: { name: true } }),
      this.prisma.priceAlert.count({ where: { triggeredAt: inDay } }),
      this.prisma.priceAlert.count({ where: { status: 'pending' } }),
      this.prisma.subscription.groupBy({ by: ['tier'], where: { status: 'active', tier: { in: ['intermediary', 'premium'] } }, _count: true }),
      // The expiry cron flips a lapsed row to status 'cancelled' (tier 'free'), so match on status + the date it lapsed.
      this.prisma.subscription.count({ where: { status: 'cancelled', currentPeriodEnd: inDay } }),
      this.prisma.subscription.findMany({
        where: { status: 'active', tier: { in: ['intermediary', 'premium'] }, currentPeriodEnd: { gte: now, lte: soon } },
        orderBy: { currentPeriodEnd: 'asc' },
        take: 10,
        select: { tier: true, currentPeriodEnd: true, user: { select: { name: true, email: true } } },
      }),
    ]);

    // The business-intelligence parts must never stop the report going out: a failure just leaves that section out.
    const [business, system] = await Promise.all([
      this.businessMetrics ? this.businessMetrics.build(day, now).catch((e) => { this.logger.error(`Business metrics failed: ${(e as Error).message}`); return null; }) : null,
      this.systemHealth ? this.systemHealth.build(day, now, market.sessionYmd).catch((e) => { this.logger.error(`System health failed: ${(e as Error).message}`); return null; }) : null,
    ]);
    const isTradingDay = day.weekday >= 1 && day.weekday <= 5;

    const tierCount = (t: string) => tierGroups.find((g) => g.tier === t)?._count ?? 0;
    const pendingNames = pendingAdvisors.map((a) => a.user.name);

    const attention: string[] = [];
    if (market.missingData) {
      attention.push(`<strong>No market data was captured</strong> on ${escapeHtml(day.label)} (a weekday). If it was not a public holiday, the price poller may be failing.`);
    }
    if (contactUnreadTotal > 0) {
      attention.push(`<strong>${contactUnreadTotal} unread contact message${contactUnreadTotal === 1 ? '' : 's'}</strong> waiting in the admin.`);
    }
    if (pendingNames.length > 0) {
      attention.push(`<strong>${pendingNames.length} advisor application${pendingNames.length === 1 ? '' : 's'} awaiting approval:</strong> ${escapeHtml(pendingNames.join(', '))}.`);
    }
    if (expiringSoon.length > 0) {
      attention.push(`<strong>${expiringSoon.length} paid subscription${expiringSoon.length === 1 ? ' expires' : 's expire'} within ${SOON_DAYS} days</strong> (listed below).`);
    }

    if (system) attention.unshift(...systemAttention(system, isTradingDay));
    if (business) attention.push(...businessAttention(business));

    return {
      day,
      business,
      system,
      market,
      activity: {
        signups: { count: signupCount, recent: signupRecent },
        leads: { captured: leadsCaptured, downloads: leadDownloads, converted: leadsConverted },
        ebooks: { count: ebookAgg._count, revenueKes: ebookAgg._sum.amountKes ?? 0 },
        contact: { count: contactCount, recent: contactRecent },
        advisors: {
          applications: advisorApps,
          approved: advisorApproved,
          queries: advisorQueries,
          alertsSent: advisorAlertAgg._count,
          alertRecipients: advisorAlertAgg._sum.recipientCount ?? 0,
          newClientRequests: advisorClientReqs,
        },
        referrals: { created: referralsCreated, rewarded: referralsRewarded },
        organizations: { created: orgsCreated.length, names: orgsCreated.map((o) => o.name) },
        priceAlerts: { triggered: alertsTriggered, activeTotal: alertsActive },
      },
      subscriptions: {
        activePaid: tierCount('intermediary') + tierCount('premium'),
        premium: tierCount('premium'),
        intermediary: tierCount('intermediary'),
        expiredInDay,
        expiringSoon: expiringSoon.map((s) => ({
          name: s.user.name,
          email: s.user.email,
          tier: s.tier,
          endsOn: s.currentPeriodEnd ? s.currentPeriodEnd.toISOString().slice(0, 10) : '',
        })),
      },
      attention,
    };
  }

  /**
   * Market movers for the report day, or - when the market was closed
   * (weekend/holiday) - for the most recent session before it, clearly
   * labelled so nobody mistakes Friday's numbers for Sunday's.
   */
  private async buildMarket(day: DayBounds): Promise<DailyReport['market']> {
    const tenDaysBefore = new Date(day.end.getTime() - 10 * 24 * 60 * 60 * 1000);
    const [latest] = await this.prisma.$queryRaw<{ d: string | null }[]>(Prisma.sql`
      select max((("timestamp" at time zone 'Africa/Nairobi')::date))::text as d
      from "StockPrice"
      where "timestamp" < ${day.end} and "timestamp" >= ${tenDaysBefore}`);
    const sessionYmd = latest?.d ?? null;
    const isWeekday = day.weekday >= 1 && day.weekday <= 5;

    if (!sessionYmd) {
      return { sessionYmd: null, sessionLabel: null, isReportDay: false, missingData: isWeekday, summary: null };
    }

    const session = boundsForYmd(sessionYmd);
    // The last snapshot of each ticker that day carries the closing price and the day's % change.
    const rows = await this.prisma.$queryRaw<PriceRow[]>(Prisma.sql`
      select distinct on (ticker) ticker, name, price, volume, change
      from "StockPrice"
      where "timestamp" >= ${session.start} and "timestamp" < ${session.end}
      order by ticker, "timestamp" desc`);

    const isReportDay = sessionYmd === day.ymd;
    return {
      sessionYmd,
      sessionLabel: session.label,
      isReportDay,
      missingData: isWeekday && !isReportDay,
      summary: computeMovers(rows),
    };
  }

  // ---------------------------------------------------------------- render

  render(r: DailyReport): { subject: string; intro: string; rawHtml: string; text: string[] } {
    const a = r.activity;
    const m = r.market;
    const sum = m.summary;
    const subject = `NSE Academy daily report - ${r.day.shortLabel}${r.attention.length ? ` (${r.attention.length} need attention)` : ''}`;

    // ---- one-line headline
    const headlineBits: string[] = [];
    if (sum) headlineBits.push(`the market had ${sum.advancers} advancers and ${sum.decliners} decliners`);
    headlineBits.push(`${a.signups.count} new signup${a.signups.count === 1 ? '' : 's'}`);
    if (a.ebooks.count) headlineBits.push(`${a.ebooks.count} ebook sale${a.ebooks.count === 1 ? '' : 's'} (${formatKes(a.ebooks.revenueKes)})`);
    const intro = `Here is what happened on ${escapeHtml(r.day.label)}: ${headlineBits.join(', ')}.`;

    // ---- market
    const moverRows = (list: Mover[]) =>
      list.map((x) => [
        `<strong>${escapeHtml(x.ticker)}</strong><br><span style="font-size:12px;color:#71717a;">${escapeHtml(x.name)}</span>`,
        x.price.toLocaleString('en-KE', { maximumFractionDigits: 2 }),
        signedPct(x.changePct),
        formatCompact(x.volume),
      ]);
    const moverCols = [
      { header: 'Stock' },
      { header: 'Price (KSh)', align: 'right' as const },
      { header: 'Change', align: 'right' as const },
      { header: 'Volume', align: 'right' as const },
    ];

    let marketHtml = '';
    if (!sum) {
      marketHtml = sectionHeading('Market') + dataTable([], [], 'No market data is available for this period.');
    } else {
      const note = m.isReportDay ? 'closing prices' : `market closed - showing the last session, ${m.sessionLabel}`;
      marketHtml =
        sectionHeading('Market', note) +
        `<p style="margin:0 0 12px;font-size:14px;color:#52525b;">${sum.traded} stocks traded &middot; ${sum.advancers} up &middot; ${sum.decliners} down &middot; ${sum.unchanged} unchanged &middot; ${formatKes(sum.totalValue)} traded</p>` +
        `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Top gainers</p>` +
        dataTable(moverCols, moverRows(sum.gainers), 'No gainers.') +
        `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Top losers</p>` +
        dataTable(moverCols, moverRows(sum.losers), 'No losers.') +
        `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Most active <span style="font-weight:400;color:#71717a;">by value traded</span></p>` +
        dataTable(
          [{ header: 'Stock' }, { header: 'Value traded', align: 'right' }, { header: 'Change', align: 'right' }, { header: 'Volume', align: 'right' }],
          sum.active.map((x) => [
            `<strong>${escapeHtml(x.ticker)}</strong><br><span style="font-size:12px;color:#71717a;">${escapeHtml(x.name)}</span>`,
            formatKes(x.value),
            signedPct(x.changePct),
            formatCompact(x.volume),
          ]),
          'No trading recorded.',
        );
    }

    // ---- activity
    const activityHtml =
      sectionHeading('Activity', r.day.shortLabel) +
      statRows([
        { label: 'New signups', value: a.signups.count },
        { label: 'Leads captured', value: a.leads.captured, note: `${a.leads.downloads} downloaded, ${a.leads.converted} converted to accounts` },
        { label: 'Ebook sales', value: a.ebooks.count, note: a.ebooks.count ? formatKes(a.ebooks.revenueKes) : undefined },
        { label: 'Contact messages', value: a.contact.count },
        { label: 'Advisor applications', value: a.advisors.applications, note: a.advisors.approved ? `${a.advisors.approved} approved` : undefined },
        { label: 'Advisor client requests', value: a.advisors.newClientRequests },
        { label: 'Client questions to advisors', value: a.advisors.queries },
        { label: 'Advisor buy/sell alerts sent', value: a.advisors.alertsSent, note: a.advisors.alertsSent ? `to ${a.advisors.alertRecipients} client(s)` : undefined },
        { label: 'Referrals started', value: a.referrals.created, note: a.referrals.rewarded ? `${a.referrals.rewarded} rewarded` : undefined },
        { label: 'New organizations', value: a.organizations.created, note: a.organizations.names.join(', ') || undefined },
        { label: 'Price alerts triggered', value: a.priceAlerts.triggered, note: `${a.priceAlerts.activeTotal} active in total` },
      ]);

    const recentLists: string[] = [];
    if (a.signups.recent.length) {
      recentLists.push(`<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">New signups</p>` +
        dataTable([{ header: 'Name' }, { header: 'Email' }], a.signups.recent.map((s) => [escapeHtml(s.name), escapeHtml(s.email)])));
    }
    if (a.contact.recent.length) {
      recentLists.push(`<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Contact messages</p>` +
        dataTable([{ header: 'From' }, { header: 'Subject' }], a.contact.recent.map((c) => [escapeHtml(c.name), escapeHtml(c.subject)])));
    }

    // ---- subscriptions
    const s = r.subscriptions;
    const subsHtml =
      sectionHeading('Subscriptions') +
      statRows([
        { label: 'Active paid subscribers', value: s.activePaid, note: `${s.premium} premium, ${s.intermediary} intermediary` },
        { label: 'Lapsed on this day', value: s.expiredInDay },
      ]) +
      (s.expiringSoon.length
        ? `<p style="margin:14px 0 4px;font-size:14px;font-weight:700;">Expiring in the next ${SOON_DAYS} days</p>` +
          dataTable([{ header: 'Subscriber' }, { header: 'Plan' }, { header: 'Ends', align: 'right' }],
            s.expiringSoon.map((x) => [`${escapeHtml(x.name)}<br><span style="font-size:12px;color:#71717a;">${escapeHtml(x.email)}</span>`, escapeHtml(x.tier), x.endsOn]))
        : '');

    const rawHtml =
      attentionBox('Needs your attention', r.attention) +
      (r.business || r.system ? kpiStrip(r.business ?? null, r.system ?? null, a.signups.count) : '') +
      (r.business ? businessHtml(r.business) : '') +
      (r.system ? systemHtml(r.system) : '') +
      marketHtml +
      activityHtml +
      recentLists.join('') +
      subsHtml;

    // ---- plain-text part
    const strip = (h: string) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    const text: string[] = [strip(intro)];
    if (r.attention.length) text.push('NEEDS ATTENTION:\n' + r.attention.map((x) => `- ${strip(x)}`).join('\n'));
    text.push(...biText(r.business ?? null, r.system ?? null));
    if (sum) {
      const line = (x: Mover) => `  ${x.ticker.padEnd(6)} ${x.price.toFixed(2).padStart(9)}  ${(x.changePct > 0 ? '+' : '') + x.changePct.toFixed(2)}%  vol ${formatCompact(x.volume)}`;
      text.push(`MARKET (${m.isReportDay ? 'closing prices' : `last session ${m.sessionLabel}`}): ${sum.advancers} up, ${sum.decliners} down, ${formatKes(sum.totalValue)} traded`);
      text.push('Top gainers:\n' + (sum.gainers.map(line).join('\n') || '  none'));
      text.push('Top losers:\n' + (sum.losers.map(line).join('\n') || '  none'));
      text.push('Most active by value:\n' + (sum.active.map((x) => `  ${x.ticker.padEnd(6)} ${formatKes(x.value)}`).join('\n') || '  none'));
    }
    text.push(
      `ACTIVITY: ${a.signups.count} signups, ${a.leads.captured} leads, ${a.ebooks.count} ebook sales (${formatKes(a.ebooks.revenueKes)}), ` +
        `${a.contact.count} contact messages, ${a.advisors.applications} advisor applications, ${a.referrals.created} referrals, ` +
        `${a.organizations.created} new organizations, ${a.priceAlerts.triggered} price alerts triggered`,
    );
    text.push(`SUBSCRIPTIONS: ${s.activePaid} active paid (${s.premium} premium, ${s.intermediary} intermediary), ${s.expiredInDay} lapsed, ${s.expiringSoon.length} expiring within ${SOON_DAYS} days`);

    return { subject, intro, rawHtml, text };
  }
}

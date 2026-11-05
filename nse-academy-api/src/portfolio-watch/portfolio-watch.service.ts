import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { escapeHtml, renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { dataTable, sectionHeading, signedPct, statRows } from '../brevo/email-blocks';
import { boundsForYmd, eatDayBounds } from '../reports/report-helpers';
import { loadDailyCloses } from '../market-data/price-history';
import {
  WatchItem,
  WatchResult,
  applyCooldowns,
  evaluateWatch,
} from './portfolio-watch';

export type SendStatus = 'sent' | 'dry-run' | 'no-holdings' | 'no-session-today' | 'already-sent-today' | 'nothing-to-report';

export interface SendOutcome {
  status: SendStatus;
  email?: string;
  items?: number;
  result?: WatchResult;
  fresh?: WatchItem[];
}

const NOTIFICATION_TYPE = 'PORTFOLIO_WATCH';

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;
const signedKes = (n: number) => `${n >= 0 ? '+' : '-'}KSh ${Math.abs(Math.round(n)).toLocaleString('en-KE')}`;
const px = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

@Injectable()
export class PortfolioWatchService {
  private readonly logger = new Logger(PortfolioWatchService.name);

  constructor(
    private prisma: PrismaService,
    private brevo: BrevoService,
    private config: ConfigService,
  ) {}

  private webUrl(): string {
    return this.config.get<string>('WEB_URL') || this.config.get<string>('SITE_URL') || 'https://nseacademy.vitaldigitalmedia.net';
  }

  /** 16:30 Nairobi, Monday-Friday: the NSE has closed at 15:00 and the closing snapshot is in. */
  @Cron('30 16 * * 1-5', { timeZone: 'Africa/Nairobi' })
  async handleDaily() {
    const out = await this.runAll();
    this.logger.log(`Portfolio watch: ${out.sent} sent, ${out.skipped} skipped, ${out.failed} failed of ${out.considered}`);
  }

  async runAll(): Promise<{ considered: number; sent: number; skipped: number; failed: number }> {
    const users = await this.prisma.user.findMany({
      where: {
        portfolioWatchEnabled: true,
        subscription: { is: { tier: 'premium', status: 'active' } },
        holdings: { some: { quantity: { gt: 0 } } },
      },
      select: { id: true },
    });
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const u of users) {
      try {
        const o = await this.sendForUser(u.id);
        if (o.status === 'sent') sent++;
        else skipped++;
      } catch (err) {
        failed++;
        this.logger.error(`Portfolio watch failed for user ${u.id}: ${(err as Error).message}`);
      }
    }
    return { considered: users.length, sent, skipped, failed };
  }

  /** Evaluates the rules against the user's holdings and today's closes. Writes nothing. */
  async evaluate(userId: string): Promise<WatchResult | null> {
    const holdings = await this.prisma.holding.findMany({ where: { userId, quantity: { gt: 0 } } });
    if (holdings.length === 0) return null;
    const series = await loadDailyCloses(this.prisma, [...new Set(holdings.map((h) => h.ticker))]);
    return evaluateWatch(
      holdings.map((h) => ({ ticker: h.ticker, quantity: h.quantity, avgCost: h.avgCost, costSource: h.costSource })),
      series,
    );
  }

  private async lastSent(userId: string, keys: string[]): Promise<Map<string, Date>> {
    if (keys.length === 0) return new Map();
    const rows = await this.prisma.portfolioAlertLog.groupBy({
      by: ['key'],
      where: { userId, key: { in: keys } },
      _max: { sentAt: true },
    });
    return new Map(rows.filter((r) => r._max.sentAt).map((r) => [r.key, r._max.sentAt as Date]));
  }

  /** What the user would be told right now, with cooldowns applied. For the in-app preview. */
  async preview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { portfolioWatchEnabled: true } });
    const result = await this.evaluate(userId);
    if (!result) return { enabled: user?.portfolioWatchEnabled ?? true, result: null, fresh: [] as WatchItem[] };
    const fresh = applyCooldowns(result.items, await this.lastSent(userId, result.items.map((i) => i.key)), new Date());
    return { enabled: user?.portfolioWatchEnabled ?? true, result, fresh };
  }

  async setEnabled(userId: string, enabled: boolean) {
    await this.prisma.user.update({ where: { id: userId }, data: { portfolioWatchEnabled: enabled } });
    return { enabled };
  }

  /**
   * Evaluates, filters by cooldown and, if anything is left, records an in-app notification and (unless the
   * user opted out) sends the email. `force` skips the "trading day" and once-a-day checks; `dryRun` stops
   * before any write or send.
   */
  async sendForUser(userId: string, opts: { force?: boolean; dryRun?: boolean } = {}): Promise<SendOutcome> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, portfolioWatchEnabled: true } });
    if (!user) throw new NotFoundException('User not found');

    const result = await this.evaluate(userId);
    if (!result) return { status: 'no-holdings', email: user.email };

    const now = new Date();
    const today = eatDayBounds(now, 0);
    if (!opts.force && result.asOf !== today.ymd) return { status: 'no-session-today', email: user.email, result };

    if (!opts.force) {
      const already = await this.prisma.notification.findFirst({
        where: { userId, type: NOTIFICATION_TYPE, createdAt: { gte: today.start } },
        select: { id: true },
      });
      if (already) return { status: 'already-sent-today', email: user.email, result };
    }

    const fresh = opts.force ? result.items : applyCooldowns(result.items, await this.lastSent(userId, result.items.map((i) => i.key)), now);
    if (fresh.length === 0) return { status: 'nothing-to-report', email: user.email, result, fresh };
    if (opts.dryRun) return { status: 'dry-run', email: user.email, items: fresh.length, result, fresh };

    const link = `${this.webUrl()}/dashboard/journal/performance`;
    await this.prisma.notification.create({
      data: {
        userId,
        type: NOTIFICATION_TYPE,
        title: `Portfolio watch: ${fresh.length} thing${fresh.length === 1 ? '' : 's'} to look at`,
        body: fresh.map((i) => i.text).slice(0, 4).join(' '),
        link,
      },
    });
    const keys = fresh.filter((i) => i.cooldownDays > 0).map((i) => i.key);
    if (keys.length) await this.prisma.portfolioAlertLog.createMany({ data: keys.map((key) => ({ userId, key })) });

    if (user.portfolioWatchEnabled) {
      const { subject, html, text } = this.renderEmail(user.name, result, fresh);
      await this.brevo.sendTransactional({
        to: { email: user.email, name: user.name },
        subject,
        htmlContent: html,
        textContent: text,
        tags: ['portfolio-watch'],
      });
    }
    return { status: 'sent', email: user.email, items: fresh.length, result, fresh };
  }

  /** Admin/test entry point: look a user up by email. */
  async sendForEmail(email: string, opts: { force?: boolean; dryRun?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) throw new NotFoundException('No user with that email');
    return this.sendForUser(user.id, opts);
  }

  renderEmail(name: string, result: WatchResult, items: WatchItem[]): { subject: string; html: string; text: string } {
    const day = result.asOf ? boundsForYmd(result.asOf) : null;
    const first = (name || '').trim().split(/\s+/)[0] || 'there';
    const pct = result.dayChangePct;
    const subject = `Portfolio watch${day ? ` - ${day.shortLabel}` : ''}: ${items.length} thing${items.length === 1 ? '' : 's'} to look at`;
    const link = `${this.webUrl()}/dashboard/journal/performance`;

    const stats = [
      { label: 'Portfolio value', value: kes(result.valueKes) },
      { label: 'Today', value: pct != null ? `${signedKes(result.dayChangeKes)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)` : signedKes(result.dayChangeKes) },
    ];
    if (result.unrealizedKes != null && result.unrealizedPct != null) {
      stats.push({
        label: result.costEstimated ? 'Gain on cost (estimated)' : 'Gain on cost',
        value: `${signedKes(result.unrealizedKes)} (${result.unrealizedPct >= 0 ? '+' : ''}${result.unrealizedPct.toFixed(1)}%)`,
      });
    }

    const list = items
      .map((i) => `<li style="margin:0 0 10px;font-size:14px;line-height:1.55;">${escapeHtml(i.text)}</li>`)
      .join('');
    const rows = result.holdings.map((h) => [
      `<strong>${escapeHtml(h.ticker)}</strong>`,
      h.quantity.toLocaleString('en-KE'),
      px(h.price),
      h.dayChangePct != null ? signedPct(h.dayChangePct) : '-',
      kes(h.valueKes),
      h.gainPct != null ? `${signedPct(h.gainPct)}${h.costEstimated ? '<span style="color:#a1a1aa;"> est.</span>' : ''}` : '-',
    ]);

    const rawHtml = [
      statRows(stats),
      sectionHeading('Worth a look'),
      `<ul style="margin:12px 0 24px;padding-left:18px;color:#18181b;">${list}</ul>`,
      sectionHeading('Your holdings', 'closing prices'),
      dataTable(
        [
          { header: 'Stock' },
          { header: 'Shares', align: 'right' },
          { header: 'Price', align: 'right' },
          { header: 'Today', align: 'right' },
          { header: 'Value', align: 'right' },
          { header: 'On cost', align: 'right' },
        ],
        rows,
      ),
    ].join('\n');

    const foot = [
      'Information only, not investment advice.',
      result.costEstimated
        ? ' Costs marked "est." use the market price on the day you imported your holdings - enter your real cost on the Performance page to make these numbers exact.'
        : '',
      ' You can turn these emails off on the same page.',
    ].join('');

    const heading = `Your portfolio${pct != null ? `: ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% today` : ''}`;
    const intro = `Hi ${escapeHtml(first)}, here is what stood out in your NSE portfolio after the close${day ? ` on ${escapeHtml(day.label)}` : ''}.`;

    const html = renderEmailHtml({
      eyebrow: 'Portfolio watch',
      heading,
      bodyHtml: [intro],
      rawHtml,
      button: { label: 'Open your portfolio', url: link },
      footNoteHtml: escapeHtml(foot),
      siteUrl: this.webUrl(),
    });
    const text = renderEmailText({
      heading,
      bodyText: [`Hi ${first}, here is what stood out in your NSE portfolio after the close${day ? ` on ${day.label}` : ''}.`, ...items.map((i) => `- ${i.text}`), `Portfolio value ${kes(result.valueKes)}.`, foot],
      button: { label: 'Open your portfolio', url: link },
      siteUrl: this.webUrl(),
    });
    return { subject, html, text };
  }
}

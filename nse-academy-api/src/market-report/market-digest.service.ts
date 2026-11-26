import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { loadDailyCloses } from '../market-data/price-history';
import { eatDayBounds } from '../reports/report-helpers';
import { MarketReportService } from './market-report.service';
import { DigestReport, buildDigestPortfolio, digestToken, renderDigest, verifyDigestToken } from './digest';
import { publicSiteUrl } from '../site-url';

export interface DigestRun {
  session: string | null;
  considered: number;
  /** Handed to Brevo. */
  sent: number;
  /** Held back on purpose: a suppressed or undeliverable address. */
  blocked: number;
  /** Already had this session's digest. */
  skipped: number;
  failed: number;
  /** Why mail was blocked or failed, with a count for each. No addresses. */
  reasons?: Record<string, number>;
  /** True when nothing was sent and `sent` is how many would be. */
  dryRun?: boolean;
  note?: string;
}

export const summarizeRun = (o: DigestRun) => o.note ?? `${o.sent} ${o.dryRun ? 'would be sent' : 'sent'}, ${o.blocked} blocked, ${o.failed} failed, ${o.skipped} already had it, of ${o.considered}`;

/** How far back a manual run may go: far enough to cover a long weekend, not so far that old news goes out by mistake. */
const MAX_CATCH_UP_DAYS = 7;

export class DigestBlockedError extends Error {}

@Injectable()
export class MarketDigestService {
  private readonly logger = new Logger(MarketDigestService.name);

  constructor(
    private prisma: PrismaService,
    private reports: MarketReportService,
    private brevo: BrevoService,
    private config: ConfigService,
    @Optional() private monitor?: JobMonitorService,
  ) {}

  private webUrl(): string {
    return publicSiteUrl((key) => this.config.get<string>(key));
  }

  private secret(): string {
    return this.config.get<string>('DIGEST_TOKEN_SECRET') || this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'changeme';
  }

  /** 21:20 Nairobi on trading days: after the 21:00 public market report has been published. */
  @Cron('20 21 * * 1-5', { timeZone: 'Africa/Nairobi' })
  async handleDaily() {
    const out = await tracked(this.monitor, 'market-digest', () => this.runAll(), summarizeRun);
    this.logger.log(`Market digest: ${summarizeRun(out)}`);
  }

  private toDigest(r: Awaited<ReturnType<MarketReportService['getLatestPublic']>>): DigestReport {
    return { sessionYmd: r.sessionYmd, shortLabel: r.facts.shortLabel, headline: r.headline, summary: r.summary, url: r.url, facts: r.facts };
  }

  /** The latest published report, if it is today's session. A digest about an old session would only confuse. */
  private async todaysReport(now: Date): Promise<DigestReport | null> {
    try {
      const r = await this.reports.getLatestPublic();
      if (r.sessionYmd !== eatDayBounds(now, 0).ymd) return null;
      return this.toDigest(r);
    } catch {
      return null;
    }
  }

  /** A named, published, recent session, for sending a digest that was missed or never went to some members. */
  private async reportFor(session: string, now: Date): Promise<DigestReport> {
    const oldest = eatDayBounds(now, MAX_CATCH_UP_DAYS).ymd;
    if (session < oldest || session > eatDayBounds(now, 0).ymd) throw new BadRequestException(`The session must be between ${oldest} and today`);
    return this.toDigest(await this.reports.getPublic(session));
  }

  /**
   * Everyone who has not opted out and has not had this session's digest. With no `session` it is today's, as the
   * evening job runs it. `dryRun` works out who would get it and who would be blocked, and sends nothing.
   */
  async runAll(now = new Date(), opts: { session?: string; dryRun?: boolean } = {}): Promise<DigestRun> {
    const report = opts.session ? await this.reportFor(opts.session, now) : await this.todaysReport(now);
    const dryRun = opts.dryRun === true;
    if (!report) return { session: null, considered: 0, sent: 0, blocked: 0, skipped: 0, failed: 0, note: "Today's market report is not published, so no digest was sent" };

    const users = await this.prisma.user.findMany({
      where: {
        digestEnabled: true,
        digestOptedOutAt: null,
        AND: { OR: [{ digestLastSentOn: null }, { digestLastSentOn: { not: report.sessionYmd } }] },
      },
      select: { id: true, email: true, name: true },
    });
    let sent = 0;
    let blocked = 0;
    let failed = 0;
    const reasons: Record<string, number> = {};
    const count = (why: string) => (reasons[why] = (reasons[why] ?? 0) + 1);
    for (const u of users) {
      try {
        if (dryRun) {
          const why = await this.brevo.blockReason(u.email);
          if (why) {
            blocked++;
            count(why);
          } else sent++;
          continue;
        }
        if ((await this.sendFor(u.id, report)) === 'sent') sent++;
      } catch (err) {
        const message = (err as Error).message;
        if (err instanceof DigestBlockedError) {
          blocked++;
          count(message);
        } else {
          failed++;
          count(message.slice(0, 160));
          this.logger.error(`Digest failed for ${u.id}: ${message}`);
        }
      }
    }
    return {
      session: report.sessionYmd,
      considered: users.length,
      sent,
      blocked,
      skipped: users.length - sent - blocked - failed,
      failed,
      ...(Object.keys(reasons).length ? { reasons } : {}),
      ...(dryRun ? { dryRun } : {}),
    };
  }

  /** Sends one member their digest and records it. `force` ignores the sent-today mark (admin test). */
  async sendFor(userId: string, report: DigestReport, opts: { force?: boolean } = {}): Promise<'sent' | 'already-sent'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, digestLastSentOn: true, subscription: { select: { tier: true, status: true, currentPeriodEnd: true } }, holdings: { where: { quantity: { gt: 0 } }, select: { ticker: true, quantity: true } } },
    });
    if (!user) return 'already-sent';
    if (!opts.force && user.digestLastSentOn === report.sessionYmd) return 'already-sent';

    const series = user.holdings.length ? await loadDailyCloses(this.prisma, [...new Set(user.holdings.map((h) => h.ticker))]) : new Map();
    const portfolio = buildDigestPortfolio(user.holdings, series, report.sessionYmd);
    const sub = user.subscription;
    const isPremium = !!sub && sub.tier === 'premium' && sub.status === 'active' && (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > Date.now());

    const web = this.webUrl();
    const { subject, html, text } = renderDigest({
      firstName: user.name,
      report,
      portfolio,
      isPremium,
      siteUrl: web,
      unsubscribeUrl: `${web}/digest/unsubscribe?u=${encodeURIComponent(user.id)}&t=${digestToken(user.id, this.secret())}`,
      manageUrl: `${web}/dashboard/account`,
    });
    const result = await this.brevo.sendTransactional({ to: { email: user.email, name: user.name }, subject, htmlContent: html, textContent: text, tags: ['market-digest'] });
    // Only a message that really left marks the member as done, so a failed one is picked up by the next run.
    if (result.sent === false) {
      if (result.blocked) throw new DigestBlockedError(result.reason);
      throw new Error(result.reason);
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { digestLastSentOn: report.sessionYmd } });
    return 'sent';
  }

  /** Admin/test: send the latest report's digest to one address, regardless of opt-in. */
  async sendTest(email: string): Promise<{ to: string; session: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) throw new Error('No user with that email');
    const report = this.toDigest(await this.reports.getLatestPublic());
    try {
      await this.sendFor(user.id, report, { force: true });
    } catch (err) {
      throw new BadRequestException(`Not sent: ${(err as Error).message}`);
    }
    return { to: email, session: report.sessionYmd };
  }

  async getPreference(userId: string): Promise<{ enabled: boolean }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { digestEnabled: true } });
    return { enabled: u?.digestEnabled ?? false };
  }

  async setPreference(userId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    await this.prisma.user.update({ where: { id: userId }, data: { digestEnabled: enabled, digestOptedOutAt: enabled ? null : new Date() } });
    return { enabled };
  }

  /** The unsubscribe link's action. Idempotent; false when the link is not genuine. */
  async unsubscribe(userId: string, token: string): Promise<boolean> {
    if (!verifyDigestToken(userId, token, this.secret())) return false;
    await this.prisma.user.updateMany({ where: { id: userId }, data: { digestEnabled: false, digestOptedOutAt: new Date() } });
    return true;
  }
}

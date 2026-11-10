import { Injectable, Logger, Optional } from '@nestjs/common';
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

export interface DigestRun {
  session: string | null;
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  note?: string;
}

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
    return this.config.get<string>('WEB_URL') || this.config.get<string>('SITE_URL') || 'https://nseacademy.vitaldigitalmedia.net';
  }

  private secret(): string {
    return this.config.get<string>('DIGEST_TOKEN_SECRET') || this.config.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'changeme';
  }

  /** 21:20 Nairobi on trading days: after the 21:00 public market report has been published. */
  @Cron('20 21 * * 1-5', { timeZone: 'Africa/Nairobi' })
  async handleDaily() {
    const out = await tracked(this.monitor, 'market-digest', () => this.runAll(), (o) => (o.note ? o.note : `${o.sent} sent, ${o.skipped} skipped, ${o.failed} failed of ${o.considered}`));
    this.logger.log(`Market digest: ${out.note ?? `${out.sent} sent, ${out.skipped} skipped, ${out.failed} failed of ${out.considered}`}`);
  }

  /** The latest published report, if it is today's session. A digest about an old session would only confuse. */
  private async todaysReport(now: Date): Promise<DigestReport | null> {
    try {
      const r = await this.reports.getLatestPublic();
      if (r.sessionYmd !== eatDayBounds(now, 0).ymd) return null;
      return { sessionYmd: r.sessionYmd, shortLabel: r.facts.shortLabel, headline: r.headline, summary: r.summary, url: r.url, facts: r.facts };
    } catch {
      return null;
    }
  }

  async runAll(now = new Date()): Promise<DigestRun> {
    const report = await this.todaysReport(now);
    if (!report) return { session: null, considered: 0, sent: 0, skipped: 0, failed: 0, note: "Today's market report is not published, so no digest was sent" };

    const users = await this.prisma.user.findMany({
      where: { digestEnabled: true, OR: [{ digestLastSentOn: null }, { digestLastSentOn: { not: report.sessionYmd } }] },
      select: { id: true, email: true, name: true },
    });
    let sent = 0;
    let failed = 0;
    for (const u of users) {
      try {
        const o = await this.sendFor(u.id, report);
        if (o === 'sent') sent++;
      } catch (err) {
        failed++;
        this.logger.error(`Digest failed for ${u.id}: ${(err as Error).message}`);
      }
    }
    return { session: report.sessionYmd, considered: users.length, sent, skipped: users.length - sent - failed, failed };
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
    await this.brevo.sendTransactional({ to: { email: user.email, name: user.name }, subject, htmlContent: html, textContent: text, tags: ['market-digest'] });
    await this.prisma.user.update({ where: { id: user.id }, data: { digestLastSentOn: report.sessionYmd } });
    return 'sent';
  }

  /** Admin/test: send the latest report's digest to one address, regardless of opt-in. */
  async sendTest(email: string): Promise<{ to: string; session: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) throw new Error('No user with that email');
    const r = await this.reports.getLatestPublic();
    const report: DigestReport = { sessionYmd: r.sessionYmd, shortLabel: r.facts.shortLabel, headline: r.headline, summary: r.summary, url: r.url, facts: r.facts };
    await this.sendFor(user.id, report, { force: true });
    return { to: email, session: r.sessionYmd };
  }

  async getPreference(userId: string): Promise<{ enabled: boolean }> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { digestEnabled: true } });
    return { enabled: u?.digestEnabled ?? false };
  }

  async setPreference(userId: string, enabled: boolean): Promise<{ enabled: boolean }> {
    await this.prisma.user.update({ where: { id: userId }, data: { digestEnabled: enabled } });
    return { enabled };
  }

  /** The unsubscribe link's action. Idempotent; false when the link is not genuine. */
  async unsubscribe(userId: string, token: string): Promise<boolean> {
    if (!verifyDigestToken(userId, token, this.secret())) return false;
    await this.prisma.user.updateMany({ where: { id: userId }, data: { digestEnabled: false } });
    return true;
  }
}

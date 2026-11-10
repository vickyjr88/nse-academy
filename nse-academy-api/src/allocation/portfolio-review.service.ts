import { BadRequestException, Body, Controller, Injectable, Logger, NotFoundException, Optional, Post, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { loadDailyCloses } from '../market-data/price-history';
import { boundsForYmd } from '../reports/report-helpers';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AllocationService } from './allocation.service';
import { periodPerformance, previousQuarter, renderReview } from './review';

export type ReviewStatus = 'sent' | 'dry-run' | 'no-holdings' | 'already-sent';

export interface ReviewRun {
  period: string;
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
  note?: string;
}

/** Reviews go out in the first week of a quarter. */
const FIRST_DAYS = 7;

@Injectable()
export class PortfolioReviewService {
  private readonly logger = new Logger(PortfolioReviewService.name);

  constructor(
    private prisma: PrismaService,
    private allocation: AllocationService,
    private brevo: BrevoService,
    private config: ConfigService,
    @Optional() private monitor?: JobMonitorService,
  ) {}

  private webUrl(): string {
    return this.config.get<string>('WEB_URL') || this.config.get<string>('SITE_URL') || 'https://nseacademy.vitaldigitalmedia.net';
  }

  /** 09:00 Nairobi on weekdays in January, April, July and October. Only the first week does anything, and a member is never sent the same quarter twice. */
  @Cron('0 9 * 1,4,7,10 1-5', { timeZone: 'Africa/Nairobi' })
  async handleQuarterly() {
    const out = await tracked(this.monitor, 'portfolio-review', () => this.runAll(), (o) => o.note ?? `${o.period}: ${o.sent} sent, ${o.skipped} skipped, ${o.failed} failed of ${o.considered}`);
    if (out.considered || out.note?.startsWith('Reviews')) this.logger.log(`Portfolio review: ${out.note ?? `${out.period}: ${out.sent} sent, ${out.failed} failed of ${out.considered}`}`);
  }

  async runAll(now = new Date(), opts: { force?: boolean } = {}): Promise<ReviewRun> {
    const q = previousQuarter(now);
    if (!opts.force && q.dayOfMonth > FIRST_DAYS) return { period: q.key, considered: 0, sent: 0, skipped: 0, failed: 0, note: `Reviews go out in the first ${FIRST_DAYS} days of the quarter` };

    const users = await this.prisma.user.findMany({
      where: {
        subscription: { is: { tier: 'premium', status: 'active', OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } },
        holdings: { some: { quantity: { gt: 0 } } },
        portfolioReviews: { none: { period: q.key } },
      },
      select: { id: true },
    });
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    for (const u of users) {
      try {
        const s = await this.sendFor(u.id, q);
        if (s === 'sent') sent++;
        else skipped++;
      } catch (err) {
        failed++;
        this.logger.error(`Portfolio review failed for ${u.id}: ${(err as Error).message}`);
      }
    }
    return { period: q.key, considered: users.length, sent, skipped, failed };
  }

  async sendFor(userId: string, q = previousQuarter(new Date()), opts: { force?: boolean; dryRun?: boolean } = {}): Promise<ReviewStatus> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
    if (!user) throw new NotFoundException('User not found');
    if (!opts.force) {
      const done = await this.prisma.portfolioReview.findUnique({ where: { userId_period: { userId, period: q.key } } });
      if (done) return 'already-sent';
    }

    const overview = await this.allocation.overview(userId);
    if (overview.rows.length === 0) return 'no-holdings';
    const loaded = await this.allocation.loadPortfolio(userId);
    const series = await loadDailyCloses(this.prisma, loaded.positions.map((p) => p.ticker), 130);
    const asOf = [...series.values()].map((s) => s[s.length - 1]?.date).filter(Boolean).sort().pop() ?? null;
    const performance = asOf ? periodPerformance(loaded.positions, series, asOf, 90) : null;
    const plan = overview.targets.length ? await this.allocation.plan(userId) : null;

    const { subject, html, text } = renderReview({
      firstName: user.name,
      periodLabel: q.label,
      asOfLabel: asOf ? boundsForYmd(asOf).label : 'the last close',
      siteUrl: this.webUrl(),
      valueKes: overview.valueKes,
      performance,
      rows: overview.rows,
      sectors: overview.sectors,
      notes: overview.notes,
      drift: plan?.drift ?? null,
      plan,
    });
    if (opts.dryRun) return 'dry-run';
    await this.brevo.sendTransactional({ to: { email: user.email, name: user.name }, subject, htmlContent: html, textContent: text, tags: ['portfolio-review'] });
    await this.prisma.portfolioReview.upsert({ where: { userId_period: { userId, period: q.key } }, create: { userId, period: q.key }, update: { sentAt: new Date() } });
    return 'sent';
  }

  async sendForEmail(email: string, opts: { force?: boolean; dryRun?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } });
    if (!user) throw new NotFoundException('No user with that email');
    return { status: await this.sendFor(user.id, previousQuarter(new Date()), opts) };
  }
}

@Controller('admin/portfolio-review')
@UseGuards(AdminAuthGuard)
export class AdminPortfolioReviewController {
  constructor(private review: PortfolioReviewService) {}

  /** Body: { email, force?, dryRun? }. */
  @Post('send')
  send(@Body() body: { email?: string; force?: boolean; dryRun?: boolean }) {
    if (!body?.email) throw new BadRequestException('email is required');
    return this.review.sendForEmail(body.email, { force: !!body.force, dryRun: !!body.dryRun });
  }

  /** Runs the quarterly job now for everyone who has not had this quarter's review, even outside the first week. */
  @Post('run')
  run() {
    return this.review.runAll(new Date(), { force: true });
  }
}

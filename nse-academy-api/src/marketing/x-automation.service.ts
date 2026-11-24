import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { publicCardUrls, reportSiteUrl, resolveCardUrls } from '../market-report/market-report.service';
import { PriceRow, parseNumber } from '../reports/report-helpers';
import { LISTED_COMPANIES } from '../market-data/listed-companies';
import { BarRow, toSessions } from './session-history';
import type { StoryInput } from './x-story';
import { XService } from './x.service';
import { XComposeService } from './x-compose';
import { SocialPostService, Delivery } from './social-post.service';
import { mediaForPlatform } from './platform-copy';
import {
  AutomationConfig,
  DEFAULT_CONFIG,
  MEDIA_ONLY_PLATFORMS,
  STARTER_CONFIG,
  SlotDef,
  SlotTemplate,
  SocialPlatform,
  normalizeConfig,
} from './x-automation.config';
import {
  NairobiClock,
  Pulse,
  RenderedSlot,
  SlotState,
  buildPulse,
  dueSlot,
  fillReportPost,
  nairobiClock,
  nairobiMinuteOfDay,
  pickLesson,
  renderSlot,
  spotlightTicker,
} from './x-slot';

const CONFIG_ID = 'default';

/**
 * One post an hour through the window configured on the X admin page.
 * The tick is every minute; `dueSlot` is what makes a minute a post.
 */
@Injectable()
export class XAutomationService implements OnModuleInit {
  private readonly logger = new Logger(XAutomationService.name);
  private configWarned = false;

  async onModuleInit(): Promise<void> {
    await this.seedConfig();
  }

  /**
   * Create-only. An admin edit after this must survive the next deploy, so a
   * restart never writes over an existing row.
   */
  private async seedConfig(): Promise<void> {
    try {
      const existing = await this.prisma.xAutomationConfig.findUnique({ where: { id: CONFIG_ID } });
      if (existing) return;
      await this.prisma.xAutomationConfig.create({
        data: { id: CONFIG_ID, config: STARTER_CONFIG as unknown as Prisma.InputJsonValue },
      });
      this.logger.log('Seeded hourly X posting: live on weekdays 09:00-16:00 Nairobi, stream off. Change it on the X admin page.');
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return;
      this.logger.error(`Could not seed X automation config. Apply migration 33_x_automation. ${(err as Error).message}`);
    }
  }

  constructor(
    private prisma: PrismaService,
    private xService: XService,
    private compose: XComposeService,
    private configService: ConfigService,
    private social: SocialPostService,
    @Optional() private monitor?: JobMonitorService,
  ) {}

  @Cron('* 9-16,21 * * 1-5', { timeZone: 'Africa/Nairobi' })
  async tick(): Promise<void> {
    try {
      await this.runOnce(new Date());
    } catch (err) {
      this.logger.error(`Hourly X slot failed: ${(err as Error).message}`);
    }
  }

  /** The account the config names, or the oldest active X account when none is selected. */
  async resolveCredentialId(config?: AutomationConfig): Promise<string | null> {
    return this.credentialId(config ?? (await this.getConfig()));
  }

  async getConfig(): Promise<AutomationConfig> {
    try {
      const row = await this.prisma.xAutomationConfig.findUnique({ where: { id: CONFIG_ID } });
      this.configWarned = false;
      return normalizeConfig(row?.config ?? DEFAULT_CONFIG);
    } catch (err) {
      if (!this.configWarned) {
        this.logger.error(`X automation config could not be read. Apply migration 33_x_automation. ${(err as Error).message}`);
        this.configWarned = true;
      }
      return { ...DEFAULT_CONFIG, enabled: false, streamEnabled: false };
    }
  }

  async saveConfig(input: unknown): Promise<AutomationConfig> {
    const config = normalizeConfig(input);
    await this.prisma.xAutomationConfig.upsert({
      where: { id: CONFIG_ID },
      create: { id: CONFIG_ID, config: config as unknown as Prisma.InputJsonValue },
      update: { config: config as unknown as Prisma.InputJsonValue },
    });
    return config;
  }

  async view(now = new Date()) {
    const config = await this.getConfig();
    const clock = nairobiClock(now);
    const [runs, spend] = await Promise.all([this.runsFor(clock.ymd), this.spend(clock.ymd)]);
    return { config, clock, runs, spend };
  }

  /** Renders every enabled slot against the prices we have now. Does not post. */
  async preview(now = new Date()) {
    const config = await this.getConfig();
    const clock = nairobiClock(now);
    const state = await this.slotState(clock);
    const due = dueSlot(config, clock, state);
    const { pulse, story } = await this.loadContext(now, spotlightTicker(config.spotlightTickers, clock.ymd));
    const reportText = await this.reportText(clock.ymd);
    const recentLessons = await this.recentLessonIndexes();
    const samples: { slotId: string; template: string; text: string | null; waiting: boolean }[] = [];
    for (const slot of config.slots.filter((s) => s.enabled)) {
      const previous = await this.previousFingerprint(slot.template, clock.ymd);
      const rendered = renderSlot({
        template: slot.template,
        pulse,
        story,
        thresholdPct: config.moverThresholdPct,
        lesson: pickLesson(config.lessons, recentLessons),
        previousFingerprint: previous,
        skipIfUnchanged: config.skipIfUnchanged,
        reportText,
      });
      samples.push({
        slotId: slot.id,
        template: slot.template,
        text: 'wait' in rendered ? null : rendered.text,
        waiting: 'wait' in rendered,
      });
    }
    return { clock, due, samples };
  }

  async runOnce(now: Date): Promise<{ status: string; summary: string }> {
    const config = await this.getConfig();
    const clock = nairobiClock(now);
    const decision = dueSlot(config, clock, await this.slotState(clock));
    if (decision.action === 'idle') return { status: 'idle', summary: decision.reason };

    const prepared = await this.prepare(config, clock, decision.slot, now);
    if ('wait' in prepared) return { status: 'waiting', summary: `${decision.slot.id} waiting for data` };

    const startedAt = new Date();
    try {
      const summary = await this.publish(config, clock, decision.slot.id, decision.slot.template, prepared);
      await this.monitor?.record('x-hourly', { ok: true, startedAt, summary });
      return { status: 'done', summary };
    } catch (err) {
      const message = (err as Error).message;
      await this.monitor?.record('x-hourly', { ok: false, startedAt, error: message });
      throw err;
    }
  }

  private async prepare(config: AutomationConfig, clock: NairobiClock, slot: SlotDef, now: Date): Promise<RenderedSlot | { wait: true }> {
    const { template, id: slotId } = slot;
    const spotlight = spotlightTicker(config.spotlightTickers, clock.ymd);
    const { pulse, story } = template === 'evening-wrap' ? { pulse: null, story: null } : await this.loadContext(now, spotlight);
    const rendered = renderSlot({
      template,
      pulse,
      story,
      thresholdPct: config.moverThresholdPct,
      lesson: pickLesson(config.lessons, await this.recentLessonIndexes()),
      previousFingerprint: await this.previousFingerprint(template, clock.ymd),
      skipIfUnchanged: config.skipIfUnchanged,
      reportText: template === 'evening-wrap' ? await this.reportText(clock.ymd) : null,
    });
    if ('wait' in rendered) return rendered;

    let text = rendered.text;
    const useAi = config.aiCompose && rendered.lessonIndex == null && template !== 'evening-wrap';
    if (useAi) text = await this.compose.rewrite(text, text, 'market', slotId);
    return { ...rendered, text };
  }

  /**
   * The X sentence goes to every enabled target. One platform failing does not
   * stop the others; the per-platform result is on the slot row so the admin
   * can see exactly what went out. A platform that needs an image is skipped
   * when the slot has none (the evening wrap is the slot that carries cards).
   */
  private async publish(config: AutomationConfig, clock: NairobiClock, slotId: string, template: SlotTemplate, rendered: RenderedSlot): Promise<string> {
    const claimed = await this.claim(clock, slotId, template, rendered, 'claimed');
    if (!claimed) return `${slotId} already claimed`;

    const targets = config.platforms.filter((target) => target.enabled);
    if (targets.length === 0) {
      await this.finish(clock, slotId, 'skipped', 'no platform enabled');
      return `${slotId} skipped: no platform enabled`;
    }

    const reportId = template === 'evening-wrap' ? clock.ymd : undefined;
    const cards = template === 'evening-wrap' ? await this.cardUrls(clock.ymd) : { story: [], feed: [] };
    const report = template === 'evening-wrap' ? await this.prisma.marketReport.findUnique({ where: { sessionDate: clock.ymd } }) : null;

    const deliveries: Delivery[] = [];
    for (const target of targets) {
      if (target.platform === 'x' && report?.xPosted) {
        deliveries.push({ platform: 'x', status: 'skipped', reason: 'report already posted to X' });
        continue;
      }
      const credential = await this.social.resolveCredential(target.platform, target.credentialId);
      if (!credential) {
        deliveries.push({ platform: target.platform, status: 'skipped', reason: 'no account selected' });
        continue;
      }
      const media = this.mediaFor(target.platform, cards);
      if (MEDIA_ONLY_PLATFORMS.includes(target.platform) && media.length === 0) {
        deliveries.push({ platform: target.platform, status: 'skipped', reason: 'no images' });
        continue;
      }
      try {
        const delivery = await this.social.publishTarget(target, rendered.text, media, credential.id, {
          mode: config.mode,
          reportType: template,
          reportId,
        });
        deliveries.push(delivery);
        if (delivery.platform === 'x' && delivery.status === 'posted' && template === 'evening-wrap') {
          await this.prisma.marketReport
            .update({
              where: { sessionDate: clock.ymd },
              data: { xPosted: true, xPostId: delivery.postId, lastXAttemptAt: new Date(), xError: null },
            })
            .catch(() => undefined);
        }
      } catch (err) {
        const message = (err as Error).message.replace(/^Failed to post to [^:]+:\s*/, '');
        deliveries.push({ platform: target.platform, status: 'failed', reason: message });
        this.logger.warn(`${slotId} failed on ${target.platform}: ${message}`);
      }
    }

    const posted = deliveries.filter((delivery) => delivery.status === 'posted' || delivery.status === 'draft');
    const failed = deliveries.filter((delivery) => delivery.status === 'failed');
    const status = posted.length > 0 ? (config.mode === 'draft' ? 'draft' : 'posted') : failed.length > 0 ? 'failed' : 'skipped';
    const summary = this.summary(slotId, deliveries);
    // Keep the slot row's postId meaningful for older screens: X first, then any platform that returned one.
    const primary = deliveries.find((delivery) => delivery.platform === 'x' && delivery.postId) ?? deliveries.find((delivery) => delivery.postId);
    await this.finish(clock, slotId, status, failed.length > 0 ? `${failed.length} platform(s) failed` : undefined, primary?.postId, deliveries);

    if (status === 'failed') throw new Error(summary);
    this.logger.log(summary);
    return summary;
  }

  private summary(slotId: string, deliveries: Delivery[]): string {
    const parts = deliveries.map((delivery) =>
      delivery.status === 'failed'
        ? `${delivery.platform} failed (${delivery.reason ?? 'unknown error'})`
        : `${delivery.platform} ${delivery.status}${delivery.reason ? ` (${delivery.reason})` : ''}`,
    );
    return `${slotId}: ${parts.join(', ')}`;
  }

  private mediaFor(platform: SocialPlatform, cards: { story: string[]; feed: string[] }): string[] {
    return mediaForPlatform(platform, cards);
  }

  /** Inserts the idempotency row. False when another process already owns this slot today. */
  private async claim(clock: NairobiClock, slotId: string, template: SlotTemplate, rendered: RenderedSlot, status: string, reason?: string): Promise<boolean> {
    try {
      await this.prisma.xSlotRun.create({
        data: {
          sessionDate: clock.ymd,
          slotId,
          status,
          template,
          content: rendered.text,
          fingerprint: rendered.fingerprint,
          lessonIndex: rendered.lessonIndex,
          reason,
        },
      });
      return true;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') return false;
      throw err;
    }
  }

  private async finish(
    clock: NairobiClock,
    slotId: string,
    status: string,
    reason?: string,
    postId?: string,
    deliveries?: Delivery[],
  ): Promise<void> {
    await this.prisma.xSlotRun.update({
      where: { sessionDate_slotId: { sessionDate: clock.ymd, slotId } },
      data: { status, reason, postId, ...(deliveries ? { deliveries: deliveries as unknown as Prisma.InputJsonValue } : {}) },
    });
  }

  private async slotState(clock: NairobiClock): Promise<SlotState> {
    const runs = await this.prisma.xSlotRun.findMany({ where: { sessionDate: clock.ymd } });
    const posted = runs.filter((run) => run.status === 'posted' || run.status === 'draft');
    const last = posted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      ranSlotIds: runs.map((run) => run.slotId),
      postsToday: posted.length,
      lastPostMinute: last ? nairobiMinuteOfDay(last.createdAt) : null,
    };
  }

  private async runsFor(ymd: string) {
    const runs = await this.prisma.xSlotRun.findMany({ where: { sessionDate: ymd }, orderBy: { createdAt: 'asc' } });
    return runs.map((run) => ({
      slotId: run.slotId,
      status: run.status,
      template: run.template,
      content: run.content,
      reason: run.reason,
      deliveries: run.deliveries ?? [],
      createdAt: run.createdAt.toISOString(),
    }));
  }

  private async spend(ymd: string) {
    const month = `m:${ymd.slice(0, 7)}`;
    const [day, monthRow] = await Promise.all([
      this.prisma.xReadSpend.findUnique({ where: { bucket: ymd } }),
      this.prisma.xReadSpend.findUnique({ where: { bucket: month } }),
    ]);
    return {
      todayPosts: day?.posts ?? 0,
      todayUsd: day?.usd ?? 0,
      monthPosts: monthRow?.posts ?? 0,
      monthUsd: monthRow?.usd ?? 0,
    };
  }

  private async previousFingerprint(template: SlotTemplate, ymd: string): Promise<string | null> {
    const prior = await this.prisma.xSlotRun.findFirst({
      where: { sessionDate: ymd, template, status: { in: ['posted', 'draft'] }, fingerprint: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    return prior?.fingerprint ?? null;
  }

  private async recentLessonIndexes(): Promise<number[]> {
    const rows = await this.prisma.xSlotRun.findMany({
      where: { lessonIndex: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { lessonIndex: true },
    });
    return rows.map((row) => row.lessonIndex).filter((n): n is number => n != null);
  }

  /**
   * The last real session and how it compares with the recent ones. The feed refreshes once a day, around the close, so
   * the rows stored today are yesterday's numbers until then. Looking at sessions (days on which the numbers actually
   * changed) is what keeps a morning post from presenting yesterday's close as today's trading.
   */
  private async loadContext(now: Date, spotlight: string | null): Promise<{ pulse: Pulse | null; story: StoryInput | null }> {
    const since = new Date(now.getTime() - 75 * 24 * 60 * 60 * 1000);
    const raw = await this.prisma.$queryRaw<{ ymd: string; ticker: string; name: string; price: number; volume: string; change: string }[]>`
      SELECT DISTINCT ON (ticker, d) d AS ymd, ticker, name, price, volume, change FROM (
        SELECT ticker, name, price, volume, change, timestamp,
               to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS d
        FROM "StockPrice"
        WHERE price > 0 AND ticker <> '' AND timestamp > ${since} AND timestamp <= ${now}
      ) x
      ORDER BY ticker, d, timestamp DESC`;
    const bars: BarRow[] = raw.map((r) => ({
      ymd: r.ymd,
      ticker: r.ticker,
      name: r.name,
      price: Number(r.price),
      volume: parseNumber(r.volume),
      changePct: parseNumber(r.change),
    }));
    const shares = Object.fromEntries(Object.entries(LISTED_COMPANIES).map(([ticker, c]) => [ticker, c.shares]));
    const history = toSessions(bars, shares);
    const last = history.sessions[history.sessions.length - 1];
    if (!last) return { pulse: null, story: null };

    const rows: PriceRow[] = bars
      .filter((b) => b.ymd === last.ymd)
      .map((b) => ({ ticker: b.ticker, name: b.name, price: b.price, volume: String(b.volume), change: String(b.changePct) }));
    const pulse = buildPulse(rows, spotlight);
    const clock = nairobiClock(now);
    const [y, m, d] = clock.ymd.split('-').map(Number);
    return { pulse, story: { todayYmd: clock.ymd, history, pulse, seed: Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) } };
  }

  private siteUrl(): string {
    return reportSiteUrl((key) => this.configService.get<string>(key));
  }

  private async reportText(ymd: string): Promise<string | null> {
    const report = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd } });
    const social = report?.social as { xPost?: string } | undefined;
    return fillReportPost(social?.xPost, ymd, this.siteUrl());
  }

  /**
   * Instagram feed images must be between 4:5 and 1.91:1. The story cards are
   * 9:16, so Instagram gets the same cards rendered at 4:5 (`?format=feed`).
   * X, Facebook, Threads and TikTok use the vertical cards.
   */
  private async cardUrls(ymd: string): Promise<{ story: string[]; feed: string[] }> {
    const report = await this.prisma.marketReport.findUnique({
      where: { sessionDate: ymd },
      select: { cardImageUrls: true, status: true },
    });
    if (!report || report.status !== 'published') return { story: [], feed: [] };
    const site = reportSiteUrl((key) => this.configService.get<string>(key));
    const story = resolveCardUrls(report.cardImageUrls ?? [], site, ymd);
    const feed = publicCardUrls(site, ymd).map((url) => `${url}?format=feed`);
    return { story, feed };
  }

  private async credentialId(config: AutomationConfig): Promise<string | null> {
    if (config.credentialId) {
      const chosen = await this.prisma.socialMediaCredential.findFirst({ where: { id: config.credentialId, platform: 'x', isActive: true }, select: { id: true } });
      if (chosen) return chosen.id;
    }
    const first = await this.prisma.socialMediaCredential.findFirst({ where: { platform: 'x', isActive: true }, select: { id: true }, orderBy: { createdAt: 'asc' } });
    return first?.id ?? null;
  }
}

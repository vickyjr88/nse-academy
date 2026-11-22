import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { eatDayBounds, PriceRow } from '../reports/report-helpers';
import { XService } from './x.service';
import { XComposeService } from './x-compose';
import { AutomationConfig, DEFAULT_CONFIG, STARTER_CONFIG, SlotTemplate, normalizeConfig } from './x-automation.config';
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
    const pulse = await this.loadPulse(now, spotlightTicker(config.spotlightTickers, clock.ymd));
    const shortLabel = eatDayBounds(now, 0).shortLabel;
    const reportText = await this.reportText(clock.ymd);
    const recentLessons = await this.recentLessonIndexes();
    const samples: { slotId: string; template: string; text: string | null; waiting: boolean }[] = [];
    for (const slot of config.slots.filter((s) => s.enabled)) {
      const previous = await this.previousFingerprint(slot.template, clock.ymd);
      const rendered = renderSlot({
        template: slot.template,
        pulse,
        shortLabel,
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

    const prepared = await this.prepare(config, clock, decision.slot.template, decision.slot.id, now);
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

  private async prepare(config: AutomationConfig, clock: NairobiClock, template: SlotTemplate, slotId: string, now: Date): Promise<RenderedSlot | { wait: true }> {
    if (template === 'evening-wrap') {
      const report = await this.prisma.marketReport.findUnique({ where: { sessionDate: clock.ymd } });
      if (report?.xPosted) {
        await this.claim(clock, slotId, template, { text: '', fingerprint: 'wrap', lessonIndex: null }, 'skipped', 'report already posted');
        return { text: '', fingerprint: 'wrap', lessonIndex: null };
      }
    }
    const spotlight = spotlightTicker(config.spotlightTickers, clock.ymd);
    const pulse = template === 'evening-wrap' ? null : await this.loadPulse(now, spotlight);
    const rendered = renderSlot({
      template,
      pulse,
      shortLabel: eatDayBounds(now, 0).shortLabel,
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

  private async publish(config: AutomationConfig, clock: NairobiClock, slotId: string, template: SlotTemplate, rendered: RenderedSlot): Promise<string> {
    if (rendered.fingerprint === 'wrap' && !rendered.text) return `${slotId} skipped: report already posted`;

    const claimed = await this.claim(clock, slotId, template, rendered, 'claimed');
    if (!claimed) return `${slotId} already claimed`;

    const credentialId = await this.credentialId(config);
    if (!credentialId) {
      await this.finish(clock, slotId, 'skipped', 'no X account selected');
      return `${slotId} skipped: no account`;
    }

    const mediaUrls = template === 'evening-wrap' ? await this.cardUrls(clock.ymd) : [];
    try {
      if (config.mode === 'draft') {
        const draft = await this.xService.saveDraft({
          credentialId,
          content: rendered.text,
          reportType: template,
          reportId: template === 'evening-wrap' ? clock.ymd : undefined,
          mediaUrls,
        });
        await this.finish(clock, slotId, 'draft', undefined, draft.id);
        this.logger.log(`Drafted ${slotId} for ${clock.ymd}`);
        return `drafted ${slotId}`;
      }
      const result = await this.xService.postToX(credentialId, rendered.text, mediaUrls, template === 'evening-wrap' ? clock.ymd : undefined, { reportType: template });
      await this.finish(clock, slotId, 'posted', undefined, result.postId);
      if (template === 'evening-wrap') {
        await this.prisma.marketReport.update({ where: { sessionDate: clock.ymd }, data: { xPosted: true, xPostId: result.postId, lastXAttemptAt: new Date(), xError: null } }).catch(() => undefined);
      }
      this.logger.log(`Posted ${slotId} for ${clock.ymd}`);
      return `posted ${slotId}`;
    } catch (err) {
      await this.finish(clock, slotId, 'failed', (err as Error).message);
      throw err;
    }
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

  private async finish(clock: NairobiClock, slotId: string, status: string, reason?: string, postId?: string): Promise<void> {
    await this.prisma.xSlotRun.update({
      where: { sessionDate_slotId: { sessionDate: clock.ymd, slotId } },
      data: { status, reason, postId },
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

  private async loadPulse(now: Date, spotlight: string | null): Promise<Pulse | null> {
    const day = eatDayBounds(now, 0);
    const raw = await this.prisma.$queryRaw<{ ticker: string; name: string; price: number; volume: string; change: string }[]>`
      SELECT DISTINCT ON (ticker) ticker, name, price, volume, change
      FROM "StockPrice"
      WHERE price > 0 AND timestamp >= ${day.start} AND timestamp < ${day.end}
      ORDER BY ticker, timestamp DESC`;
    if (raw.length === 0) return null;
    const rows: PriceRow[] = raw.map((row) => ({
      ticker: row.ticker,
      name: row.name,
      price: Number(row.price),
      volume: String(row.volume ?? ''),
      change: String(row.change ?? ''),
    }));
    return buildPulse(rows, spotlight);
  }

  private siteUrl(): string {
    return this.configService.get<string>('SITE_URL') || this.configService.get<string>('WEB_URL') || 'https://nseacademy.co.ke';
  }

  private async reportText(ymd: string): Promise<string | null> {
    const report = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd } });
    const social = report?.social as { xPost?: string } | undefined;
    return fillReportPost(social?.xPost, ymd, this.siteUrl());
  }

  private async cardUrls(ymd: string): Promise<string[]> {
    const report = await this.prisma.marketReport.findUnique({ where: { sessionDate: ymd }, select: { cardImageUrls: true } });
    return (report?.cardImageUrls ?? []).slice(0, 4);
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

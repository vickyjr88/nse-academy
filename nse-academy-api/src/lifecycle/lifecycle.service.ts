import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { assignVariant } from './ab-variant.util';

/**
 * Every engagement flow a user can move through. Kept as a single source
 * of truth so FlowEntry.flow values, the funnel/reporting queries, and the
 * architecture diagram all agree on the same six names.
 */
export const LIFECYCLE_FLOWS = [
  'day1-nurture',
  'day7-nurture',
  'day14-nurture',
  'engaged-free-tagging',
  'active-trader-tagging',
  'corporate-expiry-warning',
  'renewal-nudge',
  'winback',
  'referral-nudge',
] as const;
export type LifecycleFlow = (typeof LIFECYCLE_FLOWS)[number];

/**
 * A/B variants for the two money emails - Day 14 (the first direct paid
 * pitch) and win-back (the last recovery attempt before a lapsed user goes
 * untouched). Each variant is a genuinely different sales angle, not a
 * copy tweak, so a difference in click/conversion rate actually means
 * something. Assignment is deterministic (see ab-variant.util.ts) and
 * recorded in FlowEntry.metadata.variant so AnalyticsService can break
 * down click-through and conversion by variant.
 */
export const DAY14_VARIANTS = ['trade-journal', 'stock-advisor'] as const;
export type Day14Variant = (typeof DAY14_VARIANTS)[number];

export const WINBACK_VARIANTS = ['data-still-there', 'social-proof'] as const;
export type WinbackVariant = (typeof WINBACK_VARIANTS)[number];

/**
 * New-user and win-back lifecycle emails, plus the Tag/UserTag segmentation
 * layer the admin broadcast tool can filter on. Colocated here rather than
 * in payments.service.ts (which stays scoped to payment/subscription
 * mechanics) or a new central "jobs" module - there isn't one; every
 * @Cron in this codebase lives on the domain service that owns the data,
 * and this module owns the User/Tag lifecycle rows instead of a specific
 * feature's data, so it gets its own home.
 *
 * Every cron here follows the same dedupe idiom as
 * Subscription.expiryWarningSentAt: a nullable "sentAt" timestamp that's
 * set once and never resent, so a job that runs daily doesn't re-email
 * someone it already emailed for the same lifecycle event.
 */
@Injectable()
export class LifecycleService {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    private prisma: PrismaService,
    private brevo: BrevoService,
    private config: ConfigService,
    @Optional() private monitor?: JobMonitorService,
  ) {}

  private webUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  // A user counts as "still on free tier" for nurture purposes if they have
  // no Subscription row, or an explicit tier='free' row - same null-safe
  // pattern BroadcastService.audienceWhere already uses, so a user who never
  // touched billing isn't missed. Corporate org members are excluded
  // entirely (they're effectively premium via their org's license, per
  // deriveEffectiveTier) so they never get a "you're still on free" nudge.
  private freeTierWhere() {
    return {
      OR: [{ subscription: null }, { subscription: { tier: 'free' } }],
      orgMembership: null,
    };
  }

  // ---------------------------------------------------------------------
  // Cron jobs
  // ---------------------------------------------------------------------

  /**
   * Day 1 after signup: orientation, not a sales pitch. Fires once, the
   * morning after the day a user registered.
   */
  @Cron('0 8 * * *')
  async handleDay1Nurture() {
    return tracked(this.monitor, 'lifecycle-day1-nurture', () => this.handleDay1NurtureImpl());
  }

  private async handleDay1NurtureImpl() {
    const { start, end } = this.dayRange(1);
    await this.runDay1Nurture({ createdAt: { gte: start, lt: end } });
  }

  /**
   * Day 7: re-engagement, aimed specifically at people who haven't tried
   * the product yet (zero completed lessons) rather than everyone at the
   * 7-day mark - someone already using it doesn't need a "come try it" nudge.
   */
  @Cron('0 8 * * *')
  async handleDay7Nurture() {
    return tracked(this.monitor, 'lifecycle-day7-nurture', () => this.handleDay7NurtureImpl());
  }

  private async handleDay7NurtureImpl() {
    const { start, end } = this.dayRange(7);
    await this.runDay7Nurture({ createdAt: { gte: start, lt: end } });
  }

  /**
   * Day 14: the direct Intermediary pitch - Trade Journal + broker fee
   * tracking, the hero feature named for this push. Sent regardless of
   * lesson activity (unlike Day 7) since two weeks in is the point to make
   * the ask plainly rather than keep nudging toward free content.
   */
  @Cron('0 8 * * *')
  async handleDay14Nurture() {
    return tracked(this.monitor, 'lifecycle-day14-nurture', () => this.handleDay14NurtureImpl());
  }

  private async handleDay14NurtureImpl() {
    const { start, end } = this.dayRange(14);
    await this.runDay14Nurture({ createdAt: { gte: start, lt: end } });
  }

  // -----------------------------------------------------------------------
  // Shared eligibility + send logic for the three signup-nurture flows.
  // Each cron above calls its run* method with a "createdAt on exactly this
  // day" filter; the manual-trigger admin endpoint (see
  // LifecycleController.trigger) calls the same run* method with no date
  // filter at all, so it reaches every eligible existing user regardless of
  // when they signed up - the one thing the daily crons structurally can't
  // do, since they only ever look at "today's" cohort.
  // -----------------------------------------------------------------------

  private async runDay1Nurture(extraWhere: Record<string, unknown> = {}) {
    const users = await this.prisma.user.findMany({
      where: { ...this.freeTierWhere(), ...extraWhere, day1EmailSentAt: null },
      select: { id: true, email: true, name: true },
    });
    return this.sendNurtureBatch(users, 'day1-nurture', 'day1EmailSentAt', (u) => ({
      send: () => this.sendDay1Email(u.email, u.name),
    }));
  }

  private async runDay7Nurture(extraWhere: Record<string, unknown> = {}) {
    const users = await this.prisma.user.findMany({
      where: {
        ...this.freeTierWhere(),
        ...extraWhere,
        day7EmailSentAt: null,
        progress: { none: { completed: true } },
      },
      select: { id: true, email: true, name: true },
    });
    return this.sendNurtureBatch(users, 'day7-nurture', 'day7EmailSentAt', (u) => ({
      send: () => this.sendDay7Email(u.email, u.name),
    }));
  }

  private async runDay14Nurture(extraWhere: Record<string, unknown> = {}) {
    const users = await this.prisma.user.findMany({
      where: { ...this.freeTierWhere(), ...extraWhere, day14EmailSentAt: null },
      select: { id: true, email: true, name: true },
    });
    return this.sendNurtureBatch(users, 'day14-nurture', 'day14EmailSentAt', (u) => {
      const variant = assignVariant(u.id, 'day14-pitch', DAY14_VARIANTS);
      return { metadata: { variant }, send: () => this.sendDay14Email(u.email, u.name, variant) };
    });
  }

  private async sendNurtureBatch(
    users: { id: string; email: string; name: string }[],
    flow: LifecycleFlow,
    sentAtField: 'day1EmailSentAt' | 'day7EmailSentAt' | 'day14EmailSentAt',
    plan: (user: { id: string; email: string; name: string }) => { metadata?: Record<string, unknown>; send: () => Promise<void> },
  ): Promise<{ sent: number; failed: number }> {
    if (users.length === 0) return { sent: 0, failed: 0 };
    this.logger.log(`Running ${flow} for ${users.length} user(s)`);

    let sent = 0;
    let failed = 0;
    for (const user of users) {
      const { metadata, send } = plan(user);
      const entryId = await this.enterFlow(user.id, flow, metadata);
      try {
        await send();
        await this.prisma.user.update({ where: { id: user.id }, data: { [sentAtField]: new Date() } });
        await this.completeFlow(entryId, 'sent');
        sent++;
      } catch (err) {
        this.logger.error(`${flow} failed for user ${user.id}: ${(err as Error).message}`);
        await this.completeFlow(entryId, 'failed');
        failed++;
      }
    }
    return { sent, failed };
  }

  /**
   * Daily: tags free-tier users who've completed 3+ lessons as
   * "engaged-free" - no email, this just makes them a targetable audience
   * in the admin broadcast tool (segment filter, see LifecycleController).
   * Idempotent: relies on the UserTag composite primary key, so re-running
   * against someone already tagged is a no-op rather than an error.
   */
  @Cron('30 8 * * *')
  async handleEngagedFreeTagging() {
    return tracked(this.monitor, 'lifecycle-engaged-free-tagging', () => this.handleEngagedFreeTaggingImpl());
  }

  private async handleEngagedFreeTaggingImpl() {
    const tag = await this.prisma.tag.upsert({
      where: { name: 'engaged-free' },
      create: { name: 'engaged-free' },
      update: {},
    });

    const candidates = await this.prisma.user.findMany({
      where: {
        ...this.freeTierWhere(),
        tags: { none: { tagId: tag.id } },
      },
      select: {
        id: true,
        _count: { select: { progress: { where: { completed: true } } } },
      },
    });

    const toTag = candidates.filter((u) => u._count.progress >= 3);
    if (toTag.length === 0) return;

    this.logger.log(`Tagging ${toTag.length} user(s) as engaged-free`);
    await this.prisma.userTag.createMany({
      data: toTag.map((u) => ({ userId: u.id, tagId: tag.id, addedBy: 'system:lesson-engagement' })),
      skipDuplicates: true,
    });
    // Bulk-written as already-complete rows (rather than enterFlow +
    // completeFlow) since tagging is a single atomic step with no
    // send-that-can-fail in between - there's no meaningful "pending" state
    // to represent here, unlike the email flows above.
    await this.prisma.flowEntry.createMany({
      data: toTag.map((u) => ({
        userId: u.id,
        flow: 'engaged-free-tagging' as LifecycleFlow,
        completedAt: new Date(),
        outcome: 'sent',
        metadata: { completedLessons: u._count.progress },
      })),
    });
  }

  /**
   * Daily: tags free-tier users who've set 3+ price alerts as
   * "active-trader-free" - a deliberately SEPARATE tag from engaged-free
   * rather than an additional condition on it, so the two engagement
   * signals stay independently targetable (someone actively watching real
   * tickers is a meaningfully different audience from someone reading
   * lessons, and may respond better to a different pitch later). Same
   * idempotent upsert-tag + skipDuplicates pattern as handleEngagedFreeTagging.
   */
  @Cron('35 8 * * *')
  async handleActiveTraderTagging() {
    return tracked(this.monitor, 'lifecycle-active-trader-tagging', () => this.handleActiveTraderTaggingImpl());
  }

  private async handleActiveTraderTaggingImpl() {
    const tag = await this.prisma.tag.upsert({
      where: { name: 'active-trader-free' },
      create: { name: 'active-trader-free' },
      update: {},
    });

    const candidates = await this.prisma.user.findMany({
      where: {
        ...this.freeTierWhere(),
        tags: { none: { tagId: tag.id } },
      },
      select: {
        id: true,
        _count: { select: { priceAlerts: true } },
      },
    });

    const toTag = candidates.filter((u) => u._count.priceAlerts >= 3);
    if (toTag.length === 0) return;

    this.logger.log(`Tagging ${toTag.length} user(s) as active-trader-free`);
    await this.prisma.userTag.createMany({
      data: toTag.map((u) => ({ userId: u.id, tagId: tag.id, addedBy: 'system:price-alert-engagement' })),
      skipDuplicates: true,
    });
    await this.prisma.flowEntry.createMany({
      data: toTag.map((u) => ({
        userId: u.id,
        flow: 'active-trader-tagging' as LifecycleFlow,
        completedAt: new Date(),
        outcome: 'sent',
        metadata: { priceAlertCount: u._count.priceAlerts },
      })),
    });
  }

  /**
   * Corporate licenses had no expiry reminder at all before this - the
   * existing subscription-expiry cron in payments.service.ts only ever
   * checked personal Subscription rows. Mirrors that job's 3-day-window +
   * sentAt-dedupe pattern exactly, emailing the org's admin user.
   */
  @Cron('0 9 * * *')
  async handleCorporateExpiringSoon() {
    return tracked(this.monitor, 'lifecycle-corporate-expiring', () => this.handleCorporateExpiringSoonImpl());
  }

  private async handleCorporateExpiringSoonImpl() {
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = await this.prisma.corporateLicense.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: { gte: new Date(), lte: in3Days },
        expiryWarningSentAt: null,
      },
      include: { org: true },
    });

    if (expiringSoon.length === 0) return;
    this.logger.log(`Sending corporate expiring-soon warning for ${expiringSoon.length} license(s)`);

    for (const license of expiringSoon) {
      const admin = await this.prisma.user.findUnique({ where: { id: license.org.adminUserId } });
      if (!admin) {
        this.logger.warn(`Corporate license ${license.id} has no resolvable admin user - skipping`);
        continue;
      }
      const entryId = await this.enterFlow(admin.id, 'corporate-expiry-warning', { licenseId: license.id, orgId: license.orgId });
      try {
        await this.sendCorporateExpiringSoonEmail(admin.email, admin.name, license.org.name, license.seats, license.currentPeriodEnd);
        await this.prisma.corporateLicense.update({
          where: { id: license.id },
          data: { expiryWarningSentAt: new Date() },
        });
        await this.completeFlow(entryId, 'sent');
      } catch (err) {
        this.logger.error(`Corporate expiring-soon email failed for license ${license.id}: ${(err as Error).message}`);
        await this.completeFlow(entryId, 'failed');
      }
    }
  }

  /**
   * 5 days after a personal subscription lapses to free with no renewal -
   * an earlier, distinct touchpoint from the 7-day win-back below, not a
   * duplicate of it. Same window-based approximation as handleWinback since
   * Subscription has no updatedAt to check the exact downgrade moment against.
   */
  @Cron('0 10 * * *')
  async handleRenewalNudge() {
    return tracked(this.monitor, 'lifecycle-renewal-nudge', () => this.handleRenewalNudgeImpl());
  }

  private async handleRenewalNudgeImpl() {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.subscription.findMany({
      where: {
        tier: 'free',
        status: 'cancelled',
        currentPeriodEnd: { gte: sixDaysAgo, lt: fiveDaysAgo },
        renewalNudgeSentAt: null,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (candidates.length === 0) return;
    this.logger.log(`Sending renewal-nudge email to ${candidates.length} lapsed subscriber(s)`);

    for (const sub of candidates) {
      const entryId = await this.enterFlow(sub.userId, 'renewal-nudge');
      try {
        await this.sendRenewalNudgeEmail(sub.user.email, sub.user.name);
        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { renewalNudgeSentAt: new Date() },
        });
        await this.completeFlow(entryId, 'sent');
      } catch (err) {
        this.logger.error(`Renewal-nudge email failed for user ${sub.userId}: ${(err as Error).message}`);
        await this.completeFlow(entryId, 'failed');
      }
    }
  }

  /**
   * 7 days after a personal subscription lapses to free (see
   * PaymentsService.handleExpiredSubscriptions), one win-back attempt -
   * grounded in something real happening on the platform, never fake
   * urgency/scarcity. winbackSentAt is cleared on reactivation (see
   * clearWinbackFlag) so a future churn gets its own fresh attempt.
   */
  @Cron('0 10 * * *')
  async handleWinback() {
    return tracked(this.monitor, 'lifecycle-winback', () => this.handleWinbackImpl());
  }

  private async handleWinbackImpl() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    // updatedAt isn't tracked on Subscription, so we approximate "expired
    // about 7 days ago" via currentPeriodEnd landing in that window - close
    // enough for a one-shot win-back and avoids adding another column.
    const candidates = await this.prisma.subscription.findMany({
      where: {
        tier: 'free',
        status: 'cancelled',
        currentPeriodEnd: { gte: eightDaysAgo, lt: sevenDaysAgo },
        winbackSentAt: null,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (candidates.length === 0) return;
    this.logger.log(`Sending win-back email to ${candidates.length} lapsed subscriber(s)`);

    for (const sub of candidates) {
      const variant = assignVariant(sub.userId, 'winback-pitch', WINBACK_VARIANTS);
      const entryId = await this.enterFlow(sub.userId, 'winback', { variant });
      try {
        await this.sendWinbackEmail(sub.user.email, sub.user.name, variant);
        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { winbackSentAt: new Date() },
        });
        await this.completeFlow(entryId, 'sent');
      } catch (err) {
        this.logger.error(`Win-back email failed for user ${sub.userId}: ${(err as Error).message}`);
        await this.completeFlow(entryId, 'failed');
      }
    }
  }

  private dayRange(daysAgo: number): { start: Date; end: Date } {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - daysAgo);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  // -----------------------------------------------------------------------
  // FlowEntry bookkeeping - every cron below calls enterFlow the moment a
  // user becomes eligible (before attempting the send), then completeFlow
  // once the outcome is known. Two calls rather than one create-with-result
  // because "entered but not yet resolved" is itself a real, visible state
  // in the funnel (a user queued for today's run, mid-cron-execution) - not
  // just an implementation detail to hide.
  //
  // Public: other domain services that own a flow's underlying data (e.g.
  // ReferralsService for referral-nudge) call these directly rather than
  // duplicating this bookkeeping or routing every flow through a method on
  // this service - LifecycleService owns the FlowEntry table, not every
  // flow that writes to it.
  // -----------------------------------------------------------------------

  async enterFlow(userId: string, flow: LifecycleFlow, metadata?: Record<string, unknown>): Promise<string> {
    const entry = await this.prisma.flowEntry.create({
      data: { userId, flow, metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined },
    });
    return entry.id;
  }

  async completeFlow(entryId: string, outcome: 'sent' | 'skipped' | 'failed'): Promise<void> {
    await this.prisma.flowEntry.update({
      where: { id: entryId },
      data: { outcome, completedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------
  // Tag admin API (backs the segment picker in the broadcast compose UI)
  // ---------------------------------------------------------------------

  /**
   * Tags the automation creates and looks up by name every night. Renaming one would orphan its members and make the
   * cron create a fresh empty tag under the old name, so they cannot be renamed.
   */
  static readonly SYSTEM_TAGS: ReadonlySet<string> = new Set(['engaged-free', 'active-trader-free']);

  async listTags() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return tags.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt, memberCount: t._count.users, system: LifecycleService.SYSTEM_TAGS.has(t.name) }));
  }

  async renameTag(tagId: string, name: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException(`Tag ${tagId} not found`);
    if (LifecycleService.SYSTEM_TAGS.has(tag.name)) {
      throw new BadRequestException(`"${tag.name}" is applied by the engagement automation and cannot be renamed.`);
    }
    if (name === tag.name) return tag;
    const clash = await this.prisma.tag.findUnique({ where: { name } });
    if (clash) throw new ConflictException(`Tag "${name}" already exists`);
    return this.prisma.tag.update({ where: { id: tagId }, data: { name } });
  }

  /** Who has a tag, newest first, with whether a person or the automation applied it. */
  async listTagMembers(tagId: string, page = 1, limit = 25) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException(`Tag ${tagId} not found`);
    const take = Math.min(Math.max(limit, 1), 100);
    const p = Math.max(page, 1);
    const [rows, total] = await Promise.all([
      this.prisma.userTag.findMany({
        where: { tagId },
        orderBy: { addedAt: 'desc' },
        skip: (p - 1) * take,
        take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.userTag.count({ where: { tagId } }),
    ]);
    return {
      tag: { id: tag.id, name: tag.name, system: LifecycleService.SYSTEM_TAGS.has(tag.name) },
      data: rows.map((r) => ({ userId: r.user.id, name: r.user.name, email: r.user.email, addedAt: r.addedAt, addedBy: r.addedBy, automated: r.addedBy.startsWith('system:') })),
      total,
      page: p,
      limit: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /** Tags members given as email addresses (what an admin has to hand); reports the addresses that match nobody. */
  async applyTagByEmail(tagId: string, emails: string[]) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException(`Tag ${tagId} not found`);
    const wanted = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const users = await this.prisma.user.findMany({ where: { email: { in: wanted } }, select: { id: true, email: true } });
    const found = new Set(users.map((u) => u.email.toLowerCase()));
    const notFound = wanted.filter((e) => !found.has(e));
    if (users.length === 0) throw new BadRequestException(`None of the ${wanted.length} address${wanted.length === 1 ? '' : 'es'} belongs to a member`);
    const result = await this.prisma.userTag.createMany({ data: users.map((u) => ({ userId: u.id, tagId, addedBy: 'admin:manual' })), skipDuplicates: true });
    return { tagged: result.count, alreadyHadTag: users.length - result.count, notFound };
  }

  async createTag(name: string) {
    const existing = await this.prisma.tag.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException(`Tag "${name}" already exists`);
    }
    return this.prisma.tag.create({ data: { name } });
  }

  async deleteTag(tagId: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException(`Tag ${tagId} not found`);
    }
    await this.prisma.tag.delete({ where: { id: tagId } });
    return { deleted: true };
  }

  async applyTag(tagId: string, userIds: string[]) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new NotFoundException(`Tag ${tagId} not found`);
    }
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true } });
    if (users.length === 0) {
      throw new BadRequestException('None of the given userIds exist');
    }
    const result = await this.prisma.userTag.createMany({
      data: users.map((u) => ({ userId: u.id, tagId, addedBy: 'admin:manual' })),
      skipDuplicates: true,
    });
    return { tagged: result.count, requested: userIds.length };
  }

  async removeTag(tagId: string, userIds: string[]) {
    const result = await this.prisma.userTag.deleteMany({
      where: { tagId, userId: { in: userIds } },
    });
    return { untagged: result.count };
  }

  /**
   * Audience count for a tag, matching BroadcastService.getAudiencePreview's
   * shape so the compose UI's tag filter can reuse the same preview pattern.
   */
  async getTagAudiencePreview(tagId: string) {
    const count = await this.prisma.userTag.count({ where: { tagId } });
    return { count };
  }

  // ---------------------------------------------------------------------
  // Manual trigger - backfills existing users into a signup-nurture flow
  // right now, ignoring the exact-day-of-signup filter the daily cron uses.
  // Without this, a user who signed up before this system existed (or on
  // any day other than "exactly N days ago" at the moment the cron ran)
  // would never enter these flows at all - the crons alone can only ever
  // catch today's cohort going forward.
  // ---------------------------------------------------------------------

  private readonly TRIGGERABLE_FLOWS = ['day1-nurture', 'day7-nurture', 'day14-nurture'] as const;

  private assertTriggerable(flow: string): asserts flow is (typeof this.TRIGGERABLE_FLOWS)[number] {
    if (!this.TRIGGERABLE_FLOWS.includes(flow as never)) {
      throw new BadRequestException(
        `"${flow}" cannot be manually triggered - only ${this.TRIGGERABLE_FLOWS.join(', ')} support backfilling existing users. The other flows (tagging, expiry warnings, winback) are already date/state-driven and re-check the whole user base on every cron run.`,
      );
    }
  }

  /**
   * Preview-only count of how many existing users would receive this flow
   * right now if triggered - mirrors BroadcastService.getAudiencePreview's
   * "show the number before you commit to sending" pattern.
   */
  async previewManualTrigger(flow: string): Promise<{ count: number }> {
    this.assertTriggerable(flow);
    if (flow === 'day1-nurture') {
      const count = await this.prisma.user.count({ where: { ...this.freeTierWhere(), day1EmailSentAt: null } });
      return { count };
    }
    if (flow === 'day7-nurture') {
      const count = await this.prisma.user.count({
        where: { ...this.freeTierWhere(), day7EmailSentAt: null, progress: { none: { completed: true } } },
      });
      return { count };
    }
    const count = await this.prisma.user.count({ where: { ...this.freeTierWhere(), day14EmailSentAt: null } });
    return { count };
  }

  /**
   * Actually sends the flow's email to every currently-eligible user,
   * regardless of signup date. Reuses the exact same eligibility query and
   * send/dedupe logic as the daily cron (runDay1Nurture etc, with no date
   * filter) so a manually-triggered send behaves identically to what the
   * cron would eventually do on its own - this is a "run it now instead of
   * waiting," not a separate code path with its own rules.
   */
  async triggerManually(flow: string): Promise<{ sent: number; failed: number }> {
    this.assertTriggerable(flow);
    this.logger.log(`Manually triggering ${flow} for all eligible existing users`);
    if (flow === 'day1-nurture') return this.runDay1Nurture();
    if (flow === 'day7-nurture') return this.runDay7Nurture();
    return this.runDay14Nurture();
  }

  // ---------------------------------------------------------------------
  // Email composition
  // ---------------------------------------------------------------------

  private async sendDay1Email(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const dashboardUrl = `${this.webUrl()}/dashboard`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Getting started on NSE Academy',
        htmlContent: renderEmailHtml({
          eyebrow: 'Welcome',
          heading: `Here's where to start, ${firstName}`,
          bodyHtml: [
            "You're in - the free tier includes your investor profiler quiz result, the first 3 modules, and the full NSE glossary. Worth a look before anything else.",
            'If you want to see what a real trade actually costs you after broker fees, or get a second opinion before your next NSE buy, that\'s what the paid plans are built for.',
          ],
          button: { label: 'Go to Dashboard', url: dashboardUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Here's where to start, ${firstName}`,
          bodyText: [
            "You're in - the free tier includes your investor profiler quiz result, the first 3 modules, and the full NSE glossary. Worth a look before anything else.",
            "If you want to see what a real trade actually costs you after broker fees, or get a second opinion before your next NSE buy, that's what the paid plans are built for.",
          ],
          button: { label: 'Dashboard', url: dashboardUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['lifecycle-day1'],
      });
    } catch (err) {
      this.logger.error(`Failed to send Day 1 email to ${email}: ${(err as Error).message}`);
    }
  }

  private async sendDay7Email(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const learnUrl = `${this.webUrl()}/learn`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: "Haven't started a module yet?",
        htmlContent: renderEmailHtml({
          eyebrow: 'Still Free, Still Waiting',
          heading: `Your first module is still there, ${firstName}`,
          bodyHtml: [
            "No pressure - just a reminder that your free modules and the NSE glossary are sitting ready whenever you have 10 minutes.",
          ],
          button: { label: 'Start a module', url: learnUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Your first module is still there, ${firstName}`,
          bodyText: [
            'No pressure - just a reminder that your free modules and the NSE glossary are sitting ready whenever you have 10 minutes.',
          ],
          button: { label: 'Start a module', url: learnUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['lifecycle-day7'],
      });
    } catch (err) {
      this.logger.error(`Failed to send Day 7 email to ${email}: ${(err as Error).message}`);
    }
  }

  /**
   * Two genuinely different sales angles, A/B tested (see assignVariant):
   * "trade-journal" leads with fee-tracking (the original copy, kept as
   * the baseline), "stock-advisor" leads with the Premium-tier advisor/
   * fit-score pitch instead. Both still mention pricing plainly and link
   * to the same /pricing page - only the hook and CTA differ.
   */
  private async sendDay14Email(email: string, name: string, variant: Day14Variant): Promise<void> {
    const firstName = name.split(' ')[0];
    const pricingUrl = `${this.webUrl()}/pricing`;
    const tradeJournalCopy = {
      subject: 'What are your NSE trades actually costing you?',
      eyebrow: 'Two Weeks In',
      heading: `Quick question, ${firstName}`,
      body: [
        "Do you know what your last NSE trade cost you in broker fees, versus what you think you paid? Most free-tier investors don't track this at all.",
        'Intermediary (KSh 300/month) adds a trade journal that tracks your real broker fees automatically, plus the full 62-company deep dive and the Complete Trading Guide.',
      ],
      infoBox: 'Intermediary: KSh 300/month &middot; cancel anytime &middot; M-Pesa or card',
      buttonLabel: 'Start Intermediary',
    };
    const stockAdvisorCopy = {
      subject: 'Buying NSE stocks on a hunch, or a framework?',
      eyebrow: 'Two Weeks In',
      heading: `Second opinion, ${firstName}?`,
      body: [
        'Most retail investors pick NSE stocks off a tip or a hunch, with no check against their own risk tolerance or timeline - it usually shows up in the results.',
        'Premium (KSh 500/month) adds a personalised stock advisor with fit scores across all 62 companies, plus access to independent Financial Advisors when a tool alone isn\'t enough.',
      ],
      infoBox: 'Premium: KSh 500/month &middot; includes the Complete Investor\'s Guide ebook (worth KSh 999) &middot; cancel anytime',
      buttonLabel: 'Start Premium',
    };
    const copy = variant === 'stock-advisor' ? stockAdvisorCopy : tradeJournalCopy;

    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: copy.subject,
        htmlContent: renderEmailHtml({
          eyebrow: copy.eyebrow,
          heading: copy.heading,
          bodyHtml: copy.body,
          infoBox: copy.infoBox,
          button: { label: copy.buttonLabel, url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: copy.heading,
          bodyText: copy.body,
          button: { label: copy.buttonLabel, url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['lifecycle-day14', `variant:${variant}`],
      });
    } catch (err) {
      this.logger.error(`Failed to send Day 14 email (variant ${variant}) to ${email}: ${(err as Error).message}`);
    }
  }

  private async sendCorporateExpiringSoonEmail(
    email: string,
    name: string,
    orgName: string,
    seats: number,
    currentPeriodEnd: Date,
  ): Promise<void> {
    const firstName = name.split(' ')[0];
    const billingUrl = `${this.webUrl()}/corporate/billing`;
    const expiresOn = currentPeriodEnd.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: `${orgName}'s NSE Academy license expires soon`,
        htmlContent: renderEmailHtml({
          eyebrow: 'Expiring Soon',
          heading: `${orgName}'s license renews or ends on ${expiresOn}`,
          bodyHtml: [
            `Your organization's ${seats}-seat license renews or ends on <strong>${expiresOn}</strong>. Renew now so your team doesn't lose access.`,
          ],
          button: { label: 'Renew your license', url: billingUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `${orgName}'s license renews or ends on ${expiresOn}`,
          bodyText: [
            `Your organization's ${seats}-seat license renews or ends on ${expiresOn}. Renew now so your team doesn't lose access.`,
          ],
          button: { label: 'Renew your license', url: billingUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['corporate-license-expiring-soon'],
      });
    } catch (err) {
      this.logger.error(`Failed to send corporate expiring-soon email to ${email}: ${(err as Error).message}`);
    }
  }

  private async sendRenewalNudgeEmail(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const pricingUrl = `${this.webUrl()}/pricing`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Your subscription lapsed - still want it back?',
        htmlContent: renderEmailHtml({
          eyebrow: 'Not Renewed Yet',
          heading: `Your plan moved to free 5 days ago, ${firstName}`,
          bodyHtml: [
            "No renewal yet, so this is a quick check-in rather than a full win-back pitch - your account and data are exactly as you left them.",
            'Renewing takes under a minute if you\'re ready: KSh 300/month for Intermediary, KSh 500/month for Premium, either way cancel anytime.',
          ],
          button: { label: 'Renew now', url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Your plan moved to free 5 days ago, ${firstName}`,
          bodyText: [
            'No renewal yet, so this is a quick check-in rather than a full win-back pitch - your account and data are exactly as you left them.',
            "Renewing takes under a minute if you're ready: KSh 300/month for Intermediary, KSh 500/month for Premium, either way cancel anytime.",
          ],
          button: { label: 'Renew now', url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['subscription-renewal-nudge'],
      });
    } catch (err) {
      this.logger.error(`Failed to send renewal-nudge email to ${email}: ${(err as Error).message}`);
    }
  }

  /**
   * "data-still-there" (original copy, baseline) reassures about account
   * continuity. "social-proof" instead points at something real and
   * checkable - the Financial Advisors directory - rather than fabricated
   * numbers ("thousands of investors!"); the voice rules for this brand
   * (see the NSE Academy content package) explicitly ban vague hype, so
   * the "proof" here is a real, visitable feature, not a made-up stat.
   */
  private async sendWinbackEmail(email: string, name: string, variant: WinbackVariant): Promise<void> {
    const firstName = name.split(' ')[0];
    const pricingUrl = `${this.webUrl()}/pricing`;
    const advisorsUrl = `${this.webUrl()}/advisors`;
    const dataStillThereCopy = {
      subject: 'Come back to NSE Academy?',
      eyebrow: 'We Kept Your Seat',
      heading: `Still interested in tracking your NSE portfolio, ${firstName}?`,
      body: [
        "Your subscription lapsed a week ago and your account moved to the free tier - your data is still there, nothing was deleted.",
        'If the timing was the issue, Intermediary starts at KSh 300/month with no long-term contract - cancel anytime.',
      ],
      buttonLabel: 'See pricing',
      buttonUrl: pricingUrl,
    };
    const socialProofCopy = {
      subject: 'What you left on the table',
      eyebrow: 'Still Available',
      heading: `A quick reason to come back, ${firstName}`,
      body: [
        "Premium members get access to NSE Academy's Financial Advisors directory - independent professionals covering NSE stocks, dividend investing, and capital growth, billed separately from your subscription.",
        'Your account and history are still here exactly as you left them. Reactivating takes under a minute.',
      ],
      buttonLabel: 'See advisors and pricing',
      buttonUrl: advisorsUrl,
    };
    const copy = variant === 'social-proof' ? socialProofCopy : dataStillThereCopy;

    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: copy.subject,
        htmlContent: renderEmailHtml({
          eyebrow: copy.eyebrow,
          heading: copy.heading,
          bodyHtml: copy.body,
          button: { label: copy.buttonLabel, url: copy.buttonUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: copy.heading,
          bodyText: copy.body,
          button: { label: copy.buttonLabel, url: copy.buttonUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['subscription-winback', `variant:${variant}`],
      });
    } catch (err) {
      this.logger.error(`Failed to send win-back email (variant ${variant}) to ${email}: ${(err as Error).message}`);
    }
  }
}

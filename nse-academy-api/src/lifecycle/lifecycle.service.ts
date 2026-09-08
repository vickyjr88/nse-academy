import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';

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
    const { start, end } = this.dayRange(1);
    const users = await this.prisma.user.findMany({
      where: {
        ...this.freeTierWhere(),
        createdAt: { gte: start, lt: end },
        day1EmailSentAt: null,
      },
      select: { id: true, email: true, name: true },
    });

    if (users.length === 0) return;
    this.logger.log(`Sending Day 1 nurture email to ${users.length} user(s)`);

    for (const user of users) {
      try {
        await this.sendDay1Email(user.email, user.name);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { day1EmailSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Day 1 nurture failed for user ${user.id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Day 7: re-engagement, aimed specifically at people who haven't tried
   * the product yet (zero completed lessons) rather than everyone at the
   * 7-day mark - someone already using it doesn't need a "come try it" nudge.
   */
  @Cron('0 8 * * *')
  async handleDay7Nurture() {
    const { start, end } = this.dayRange(7);
    const users = await this.prisma.user.findMany({
      where: {
        ...this.freeTierWhere(),
        createdAt: { gte: start, lt: end },
        day7EmailSentAt: null,
        progress: { none: { completed: true } },
      },
      select: { id: true, email: true, name: true },
    });

    if (users.length === 0) return;
    this.logger.log(`Sending Day 7 nurture email to ${users.length} user(s)`);

    for (const user of users) {
      try {
        await this.sendDay7Email(user.email, user.name);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { day7EmailSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Day 7 nurture failed for user ${user.id}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Day 14: the direct Intermediary pitch - Trade Journal + broker fee
   * tracking, the hero feature named for this push. Sent regardless of
   * lesson activity (unlike Day 7) since two weeks in is the point to make
   * the ask plainly rather than keep nudging toward free content.
   */
  @Cron('0 8 * * *')
  async handleDay14Nurture() {
    const { start, end } = this.dayRange(14);
    const users = await this.prisma.user.findMany({
      where: {
        ...this.freeTierWhere(),
        createdAt: { gte: start, lt: end },
        day14EmailSentAt: null,
      },
      select: { id: true, email: true, name: true },
    });

    if (users.length === 0) return;
    this.logger.log(`Sending Day 14 nurture email to ${users.length} user(s)`);

    for (const user of users) {
      try {
        await this.sendDay14Email(user.email, user.name);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { day14EmailSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Day 14 nurture failed for user ${user.id}: ${(err as Error).message}`);
      }
    }
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
  }

  /**
   * Corporate licenses had no expiry reminder at all before this - the
   * existing subscription-expiry cron in payments.service.ts only ever
   * checked personal Subscription rows. Mirrors that job's 3-day-window +
   * sentAt-dedupe pattern exactly, emailing the org's admin user.
   */
  @Cron('0 9 * * *')
  async handleCorporateExpiringSoon() {
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
      try {
        const admin = await this.prisma.user.findUnique({ where: { id: license.org.adminUserId } });
        if (!admin) {
          this.logger.warn(`Corporate license ${license.id} has no resolvable admin user - skipping`);
          continue;
        }
        await this.sendCorporateExpiringSoonEmail(admin.email, admin.name, license.org.name, license.seats, license.currentPeriodEnd);
        await this.prisma.corporateLicense.update({
          where: { id: license.id },
          data: { expiryWarningSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Corporate expiring-soon email failed for license ${license.id}: ${(err as Error).message}`);
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
      try {
        await this.sendWinbackEmail(sub.user.email, sub.user.name);
        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { winbackSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Win-back email failed for user ${sub.userId}: ${(err as Error).message}`);
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

  // ---------------------------------------------------------------------
  // Tag admin API (backs the segment picker in the broadcast compose UI)
  // ---------------------------------------------------------------------

  async listTags() {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });
    return tags.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt, memberCount: t._count.users }));
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

  private async sendDay14Email(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const pricingUrl = `${this.webUrl()}/pricing`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'What are your NSE trades actually costing you?',
        htmlContent: renderEmailHtml({
          eyebrow: 'Two Weeks In',
          heading: `Quick question, ${firstName}`,
          bodyHtml: [
            'Do you know what your last NSE trade cost you in broker fees, versus what you think you paid? Most free-tier investors don\'t track this at all.',
            'Intermediary (KSh 300/month) adds a trade journal that tracks your real broker fees automatically, plus the full 62-company deep dive and the Complete Trading Guide.',
          ],
          infoBox: 'Intermediary: KSh 300/month &middot; cancel anytime &middot; M-Pesa or card',
          button: { label: 'Start Intermediary', url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Quick question, ${firstName}`,
          bodyText: [
            "Do you know what your last NSE trade cost you in broker fees, versus what you think you paid? Most free-tier investors don't track this at all.",
            'Intermediary (KSh 300/month) adds a trade journal that tracks your real broker fees automatically, plus the full 62-company deep dive and the Complete Trading Guide.',
          ],
          button: { label: 'Start Intermediary', url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['lifecycle-day14'],
      });
    } catch (err) {
      this.logger.error(`Failed to send Day 14 email to ${email}: ${(err as Error).message}`);
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

  private async sendWinbackEmail(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const pricingUrl = `${this.webUrl()}/pricing`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Come back to NSE Academy?',
        htmlContent: renderEmailHtml({
          eyebrow: 'We Kept Your Seat',
          heading: `Still interested in tracking your NSE portfolio, ${firstName}?`,
          bodyHtml: [
            "Your subscription lapsed a week ago and your account moved to the free tier - your data is still there, nothing was deleted.",
            'If the timing was the issue, Intermediary starts at KSh 300/month with no long-term contract - cancel anytime.',
          ],
          button: { label: 'See pricing', url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Still interested in tracking your NSE portfolio, ${firstName}?`,
          bodyText: [
            'Your subscription lapsed a week ago and your account moved to the free tier - your data is still there, nothing was deleted.',
            'If the timing was the issue, Intermediary starts at KSh 300/month with no long-term contract - cancel anytime.',
          ],
          button: { label: 'See pricing', url: pricingUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['subscription-winback'],
      });
    } catch (err) {
      this.logger.error(`Failed to send win-back email to ${email}: ${(err as Error).message}`);
    }
  }
}

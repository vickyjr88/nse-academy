import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from '../referrals/referrals.service';
import { EbookService } from '../ebook/ebook.service';
import { BrevoService } from '../brevo/brevo.service';
import { PaystackService } from '../paystack/paystack.service';
import { TIER_LEVEL, computeEffectiveTier } from '../auth/effective-tier.util';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { AdminNotifierService } from '../admin-notifier/admin-notifier.service';

export type SubscriptionPlan = 'intermediary' | 'premium';
export type BillingMonths = 1 | 3 | 6 | 12;

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  intermediary: 30000, // KSh 300 in kobo
  premium: 50000,      // KSh 500 in kobo
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  intermediary: 'Intermediary',
  premium: 'Premium',
};

export const VALID_MONTHS: BillingMonths[] = [1, 3, 6, 12];

// Longer prepaid terms earn a bigger discount - 1 month is full price.
export const DISCOUNT_BY_MONTHS: Record<BillingMonths, number> = { 1: 0, 3: 0.05, 6: 0.10, 12: 0.15 };

export function computeAmountKobo(plan: SubscriptionPlan, months: BillingMonths): number {
  const base = PLAN_PRICES[plan] * months;
  return Math.round(base * (1 - DISCOUNT_BY_MONTHS[months]));
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computePeriodEnd(months: BillingMonths): Date {
  return new Date(Date.now() + months * 30 * DAY_MS);
}

export type PeriodKind = 'new' | 'renewal' | 'upgrade' | 'kept-higher';

export interface ExistingPlan {
  tier: string;
  status: string;
  currentPeriodEnd: Date | null;
}

/**
 * What a payment does to an account. The old behaviour - end = now + months, always - threw away whatever the
 * member had already paid for, which is why early renewal was never offered. Now:
 *  - no live plan (new, lapsed or expired): starts today;
 *  - same plan, still running: the new months are added after the current end, so nothing is lost;
 *  - upgrade (e.g. Intermediary -> Premium): the unused days of the old plan carry over, valued at the old price
 *    over the new price (a day of KSh 300 plan is worth 0.6 of a day of KSh 500 plan), so nothing is lost and a
 *    long cheap plan cannot be turned into a long expensive one for one cheap month;
 *  - a lower plan bought while a higher one is running: the member keeps the higher tier and the payment buys
 *    proportionally fewer days of it (the API refuses to start such a purchase; this only covers a race).
 */
export function computeNewPeriod(
  existing: ExistingPlan | null | undefined,
  plan: SubscriptionPlan,
  months: BillingMonths,
  now: Date = new Date(),
): { tier: SubscriptionPlan; currentPeriodEnd: Date; kind: PeriodKind } {
  const purchasedMs = months * 30 * DAY_MS;
  const live =
    existing &&
    existing.status === 'active' &&
    existing.currentPeriodEnd &&
    existing.currentPeriodEnd.getTime() > now.getTime() &&
    PLAN_PRICES[existing.tier as SubscriptionPlan]
      ? existing
      : null;
  if (!live) return { tier: plan, currentPeriodEnd: new Date(now.getTime() + purchasedMs), kind: 'new' };

  const end = (live.currentPeriodEnd as Date).getTime();
  const current = live.tier as SubscriptionPlan;
  if (current === plan) return { tier: plan, currentPeriodEnd: new Date(end + purchasedMs), kind: 'renewal' };

  const level = (t: string) => TIER_LEVEL[t] ?? 0;
  if (level(plan) > level(current)) {
    const carried = Math.floor(((end - now.getTime()) * PLAN_PRICES[current]) / PLAN_PRICES[plan]);
    return { tier: plan, currentPeriodEnd: new Date(now.getTime() + carried + purchasedMs), kind: 'upgrade' };
  }
  const bought = Math.floor((purchasedMs * PLAN_PRICES[plan]) / PLAN_PRICES[current]);
  return { tier: current, currentPeriodEnd: new Date(end + bought), kind: 'kept-higher' };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackSecret: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private referrals: ReferralsService,
    private ebookService: EbookService,
    private brevo: BrevoService,
    private paystack: PaystackService,
    private adminNotifier: AdminNotifierService,
    @Optional() private monitor?: JobMonitorService,
  ) {
    this.paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  private webUrl(): string {
    return (
      this.configService.get<string>('WEB_URL') ||
      this.configService.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  async initializeTransaction(
    userId: string,
    email: string,
    plan: SubscriptionPlan = 'premium',
    months: BillingMonths = 1,
  ) {
    if (!PLAN_PRICES[plan]) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
    }
    if (!VALID_MONTHS.includes(months)) {
      throw new BadRequestException(`Invalid months: ${months}. Must be one of ${VALID_MONTHS.join(', ')}`);
    }

    if (!this.paystackSecret) {
      this.logger.error('PAYSTACK_SECRET_KEY is not configured');
      throw new InternalServerErrorException('Payment system configuration missing');
    }

    // Extending the current plan or upgrading is fine at any time; stepping down to a lower plan while a higher one is
    // still running would only confuse the account, so refuse it up front.
    const current = await this.prisma.subscription.findUnique({ where: { userId } });
    if (
      current &&
      current.status === 'active' &&
      current.currentPeriodEnd &&
      current.currentPeriodEnd.getTime() > Date.now() &&
      (TIER_LEVEL[current.tier] ?? 0) > (TIER_LEVEL[plan] ?? 0)
    ) {
      const label = PLAN_LABELS[current.tier as SubscriptionPlan] ?? current.tier;
      const until = current.currentPeriodEnd.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
      throw new BadRequestException(`You are on ${label} until ${until}. Extend ${label} instead of switching to a lower plan.`);
    }

    const json = await this.paystack.initializeTransaction({
      email,
      amountKobo: computeAmountKobo(plan, months),
      callbackUrl: `${this.configService.get('WEB_URL', 'https://nseacademy.vitaldigitalmedia.net')}/payment/callback`,
      metadata: { type: 'subscription', userId, plan, months },
    });
    if (!json.status) {
      this.logger.error(`Paystack initialization failed: ${json.message || 'Unknown error'}`);
      throw new InternalServerErrorException(json.message || 'Paystack initialization failed');
    }

    return json.data; // { authorization_url, access_code, reference }
  }

  /**
   * Malformed-but-harmless events (missing metadata we can't act on) return
   * normally so Paystack doesn't keep retrying something that will never
   * succeed. A genuine processing failure (DB error, activation throwing)
   * instead propagates out of this method so the controller returns a
   * non-2xx status - Paystack retries those, which is what we want for a
   * payment that came in fine but failed to apply on our end.
   */
  async handleWebhook(body: any) {
    const event = body.event;
    const data = body.data;

    this.logger.log(`Received Paystack webhook event: ${event}`);

    if (event !== 'charge.success') {
      return { received: true };
    }

    const paymentType: string = data.metadata?.type || 'subscription';
    const userId = data.metadata?.userId;
    const reference = data.reference;

    if (paymentType === 'ebook') {
      const productId: string = data.metadata?.productId;
      const priceKes: number = data.metadata?.price_kes ?? 0;
      const email: string =
        data.metadata?.email || data.customer?.email || '';

      if (!productId) {
        this.logger.error('Ebook webhook missing productId - ignoring');
        return { received: true };
      }
      if (!email && !userId) {
        this.logger.error('Ebook webhook missing email and userId - ignoring');
        return { received: true };
      }

      await this.ebookService.activateFromWebhook({
        userId: userId || null,
        email,
        productId,
        reference,
        priceKes,
      });
      this.logger.log(
        `[Webhook] Ebook ${productId} activated for ${email || userId}`,
      );
    } else {
      if (!userId) {
        this.logger.error('No userId found in webhook metadata - ignoring');
        return { received: true };
      }
      // --- Subscription payment (default) ---
      const plan: SubscriptionPlan = data.metadata.plan || 'premium';
      const months: BillingMonths = VALID_MONTHS.includes(data.metadata.months) ? data.metadata.months : 1;
      if (!PLAN_PRICES[plan]) {
        this.logger.error(`Subscription webhook ${reference} names an unknown plan "${plan}" - ignoring`);
        return { received: true };
      }
      await this.applySubscriptionPayment(userId, reference, plan, months);
    }

    return { received: true };
  }

  /**
   * Unified verify endpoint - inspects Paystack metadata.type to determine
   * whether this is a subscription or ebook payment, then delegates accordingly.
   */
  async verifyAny(userId: string | null, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const json = await this.paystack.verifyTransaction(reference);

    if (!json.status || json.data?.status !== 'success') {
      this.logger.warn(`Verify failed for ref ${reference}: ${json.message}`);
      throw new BadRequestException(json.message || 'Payment not confirmed by Paystack');
    }

    const metaUserId: string | undefined = json.data?.metadata?.userId;
    if (metaUserId && userId && metaUserId !== userId) {
      throw new BadRequestException('Reference does not belong to this user');
    }

    const paymentType: string = json.data?.metadata?.type || 'subscription';

    if (paymentType === 'ebook') {
      const result = await this.ebookService.verifyAndActivate(
        reference,
        userId || metaUserId || null,
      );
      return { ...result, type: 'ebook' };
    }

    if (!userId) {
      throw new BadRequestException(
        'Log in to activate a subscription payment. Ebook purchases can complete as a guest.',
      );
    }

    return this.activateSubscription(userId, reference, json.data?.metadata);
  }

  /** Legacy subscription-only verify (kept for backward compatibility) */
  async verifyAndActivate(userId: string, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const json = await this.paystack.verifyTransaction(reference);

    if (!json.status || json.data?.status !== 'success') {
      this.logger.warn(`Verify failed for ref ${reference}: ${json.message}`);
      throw new BadRequestException(json.message || 'Payment not confirmed by Paystack');
    }

    const metaUserId: string = json.data?.metadata?.userId;
    if (metaUserId && metaUserId !== userId) {
      throw new BadRequestException('Reference does not belong to this user');
    }

    return this.activateSubscription(userId, reference, json.data?.metadata);
  }

  private async activateSubscription(userId: string, reference: string, metadata: any) {
    const plan: SubscriptionPlan = metadata?.plan || 'premium';
    const months: BillingMonths = VALID_MONTHS.includes(metadata?.months) ? metadata.months : 1;
    if (!PLAN_PRICES[plan]) throw new BadRequestException(`Invalid plan: ${plan}`);

    const out = await this.applySubscriptionPayment(userId, reference, plan, months);
    return { success: true, tier: out.tier, currentPeriodEnd: out.currentPeriodEnd, type: 'subscription' };
  }

  /**
   * Applies one successful subscription payment to the account, exactly once. The webhook and the return-page verify
   * both call this, usually within seconds of each other: the ProcessedPayment row (unique on the Paystack reference,
   * written in the same transaction as the subscription change) lets exactly one of them win, and a failure rolls the
   * record back so Paystack's retry still gets to apply it.
   */
  private async applySubscriptionPayment(userId: string, reference: string, plan: SubscriptionPlan, months: BillingMonths) {
    const now = new Date();
    const out = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({ where: { userId } });
      // Payments applied before ProcessedPayment existed are recognised by the reference stored on the subscription.
      if (existing?.paystackSubId === reference) {
        return { applied: false as const, tier: existing.tier, currentPeriodEnd: existing.currentPeriodEnd };
      }
      const { count } = await tx.processedPayment.createMany({ data: [{ reference, userId, plan, months }], skipDuplicates: true });
      if (count === 0) return { applied: false as const, tier: existing?.tier ?? plan, currentPeriodEnd: existing?.currentPeriodEnd ?? null };

      const next = computeNewPeriod(existing, plan, months, now);
      await tx.subscription.upsert({
        where: { userId },
        create: { userId, tier: next.tier, status: 'active', paystackSubId: reference, currentPeriodEnd: next.currentPeriodEnd },
        update: {
          tier: next.tier,
          status: 'active',
          paystackSubId: reference,
          currentPeriodEnd: next.currentPeriodEnd,
          expiryWarningSentAt: null,
          winbackSentAt: null,
          renewalNudgeSentAt: null,
        },
      });
      return { applied: true as const, tier: next.tier, currentPeriodEnd: next.currentPeriodEnd, kind: next.kind };
    });

    if (!out.applied) {
      this.logger.log(`Subscription payment ${reference} for user ${userId} was already applied - nothing to do`);
      return out;
    }

    this.logger.log(`Subscription payment ${reference} applied for user ${userId}: ${plan} x${months} (${out.kind}), now ${out.tier} until ${out.currentPeriodEnd.toISOString()}`);
    // Completes the referral if this is the user's first paid subscription (idempotent inside).
    await this.referrals.completeReferral(userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      void this.sendSubscriptionConfirmedEmail(user.email, user.name, out.tier as SubscriptionPlan, months, out.currentPeriodEnd, out.kind);
      void this.alertAdminOfSubscription(user, plan, months, reference);
    }
    return out;
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    const { effectiveTier } = await computeEffectiveTier(this.prisma, userId);

    return { ...(sub || { tier: 'free', status: 'none' }), effectiveTier };
  }

  /**
   * Personal subscriptions never had anything flipping them back to free
   * once currentPeriodEnd passed - deriveEffectiveTier only reads `tier`,
   * so an expired-but-untouched row kept granting paid access forever.
   * Runs once a day; downgrades the row in place (keeps history) and
   * emails the user so they know why they lost access.
   */
  @Cron('0 6 * * *')
  async handleExpiredSubscriptions() {
    return tracked(this.monitor, 'subscription-expiry', () => this.handleExpiredSubscriptionsImpl());
  }

  private async handleExpiredSubscriptionsImpl() {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        tier: { in: ['intermediary', 'premium'] },
        currentPeriodEnd: { lt: new Date() },
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (expired.length === 0) return;

    this.logger.log(`Downgrading ${expired.length} expired subscription(s) to free`);

    for (const sub of expired) {
      try {
        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { tier: 'free', status: 'cancelled' },
        });
        await this.sendExpiryEmail(sub.user.email, sub.user.name);
      } catch (err) {
        this.logger.error(`Failed to downgrade subscription for user ${sub.userId}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Warns users 3 days before their subscription lapses, so the expiry
   * downgrade above isn't the first they hear of it. Guarded by
   * expiryWarningSentAt so the daily cron doesn't resend the same warning
   * every day in that 3-day window; cleared on any renewal (see
   * handleWebhook/activateSubscription) so a later expiry gets its own warning.
   */
  @Cron('0 7 * * *')
  async handleExpiringSoonSubscriptions() {
    return tracked(this.monitor, 'subscription-expiring-soon', () => this.handleExpiringSoonSubscriptionsImpl());
  }

  private async handleExpiringSoonSubscriptionsImpl() {
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const expiringSoon = await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        tier: { in: ['intermediary', 'premium'] },
        currentPeriodEnd: { gte: new Date(), lte: in3Days },
        expiryWarningSentAt: null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (expiringSoon.length === 0) return;

    this.logger.log(`Sending expiring-soon warning to ${expiringSoon.length} subscriber(s)`);

    for (const sub of expiringSoon) {
      try {
        await this.sendExpiringSoonEmail(sub.user.email, sub.user.name, sub.tier as SubscriptionPlan, sub.currentPeriodEnd!);
        await this.prisma.subscription.update({
          where: { userId: sub.userId },
          data: { expiryWarningSentAt: new Date() },
        });
      } catch (err) {
        this.logger.error(`Failed to send expiring-soon email for user ${sub.userId}: ${(err as Error).message}`);
      }
    }
  }

  private async alertAdminOfSubscription(
    user: { id: string; name: string; email: string },
    plan: SubscriptionPlan,
    months: BillingMonths,
    reference: string,
  ): Promise<void> {
    await this.adminNotifier.paymentReceived({
      kind: 'Subscription',
      summary: `${PLAN_LABELS[plan]} plan, ${months} month${months === 1 ? '' : 's'}`,
      customer: `${user.name} <${user.email}>`,
      amountKes: computeAmountKobo(plan, months) / 100,
      reference,
      adminPath: user.id,
    });
  }

  private async sendSubscriptionConfirmedEmail(
    email: string,
    name: string,
    plan: SubscriptionPlan,
    months: BillingMonths,
    currentPeriodEnd: Date,
    kind: PeriodKind = 'new',
  ): Promise<void> {
    const firstName = name.split(' ')[0];
    const planLabel = PLAN_LABELS[plan];
    const dashboardUrl = `${this.webUrl()}/dashboard`;
    const renewsOn = currentPeriodEnd.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    const renewed = kind === 'renewal' || kind === 'kept-higher';
    const monthsLabel = `${months} month${months === 1 ? '' : 's'}`;
    const infoBox = renewed
      ? `Plan: <strong>${planLabel}</strong> &middot; Added ${monthsLabel} &middot; Now runs until ${renewsOn}`
      : `Plan: <strong>${planLabel}</strong> &middot; Billed for ${monthsLabel} &middot; Renews ${renewsOn}`;
    const lead = renewed
      ? `We've added ${monthsLabel} to your <strong>${planLabel}</strong> plan on top of the time you already had. It now runs until <strong>${renewsOn}</strong>.`
      : `Thanks for upgrading! Your <strong>${planLabel}</strong> subscription is active now - personalised stock picks, deep-dive research, and everything else that tier unlocks is ready in your dashboard.`;
    const leadText = renewed
      ? `We've added ${monthsLabel} to your ${planLabel} plan on top of the time you already had. It now runs until ${renewsOn}.`
      : `Thanks for upgrading! Your ${planLabel} subscription is active now (billed for ${monthsLabel}, renews ${renewsOn}) - everything that tier unlocks is ready in your dashboard.`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: renewed ? `Your ${planLabel} plan has been extended` : `You're on ${planLabel} - welcome aboard`,
        htmlContent: renderEmailHtml({
          eyebrow: renewed ? 'Plan Extended' : 'Subscription Confirmed',
          heading: renewed ? `Thanks for renewing, ${firstName}` : `You're on ${planLabel}, ${firstName}`,
          bodyHtml: [lead],
          infoBox,
          button: { label: 'Go to Dashboard', url: dashboardUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: renewed ? `Thanks for renewing, ${firstName}` : `You're on ${planLabel}, ${firstName}`,
          bodyText: [leadText],
          button: { label: 'Dashboard', url: dashboardUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['subscription-confirmed'],
      });
    } catch (err) {
      this.logger.error(`Failed to send subscription-confirmed email to ${email}: ${(err as Error).message}`);
    }
  }

  private async sendExpiringSoonEmail(
    email: string,
    name: string,
    tier: SubscriptionPlan,
    currentPeriodEnd: Date,
  ): Promise<void> {
    const firstName = name.split(' ')[0];
    const planLabel = PLAN_LABELS[tier] ?? tier;
    const renewUrl = `${this.webUrl()}/dashboard/billing`;
    const expiresOn = currentPeriodEnd.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: `Your ${planLabel} subscription expires soon`,
        htmlContent: renderEmailHtml({
          eyebrow: 'Expiring Soon',
          heading: `Your subscription expires soon, ${firstName}`,
          bodyHtml: [
            `Your <strong>${planLabel}</strong> subscription renews or ends on <strong>${expiresOn}</strong>. Renew now to avoid losing access to personalised stock picks and deep-dive research.`,
          ],
          button: { label: 'Renew your subscription', url: renewUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Your subscription expires soon, ${firstName}`,
          bodyText: [
            `Your ${planLabel} subscription renews or ends on ${expiresOn}. Renew now to avoid losing access to personalised stock picks and deep-dive research.`,
          ],
          button: { label: 'Renew your subscription', url: renewUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['subscription-expiring-soon'],
      });
    } catch (err) {
      this.logger.error(`Failed to send expiring-soon email to ${email}: ${(err as Error).message}`);
    }
  }

  private async sendExpiryEmail(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const upgradeUrl = `${this.webUrl()}/pricing`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Your NSE Academy subscription has expired',
        htmlContent: renderEmailHtml({
          eyebrow: 'Subscription Expired',
          heading: `Your subscription has expired, ${firstName}`,
          bodyHtml: [
            "Your paid plan has ended and your account has moved to the free tier. You'll keep access to everything free tier includes, but premium features like personalised stock picks and deep-dive research are now paused.",
          ],
          button: { label: 'Renew your subscription', url: upgradeUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `Your subscription has expired, ${firstName}`,
          bodyText: [
            "Your paid plan has ended and your account has moved to the free tier. You'll keep access to everything free tier includes, but premium features like personalised stock picks and deep-dive research are now paused.",
          ],
          button: { label: 'Renew your subscription', url: upgradeUrl },
          siteUrl: this.webUrl(),
        }),
        tags: ['subscription-expired'],
      });
    } catch (err) {
      this.logger.error(`Failed to send subscription-expired email to ${email}: ${(err as Error).message}`);
    }
  }
}

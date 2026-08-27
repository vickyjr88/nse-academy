import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from '../referrals/referrals.service';
import { EbookService } from '../ebook/ebook.service';
import { BrevoService } from '../brevo/brevo.service';
import { PaystackService } from '../paystack/paystack.service';
import { computeEffectiveTier } from '../auth/effective-tier.util';
import { renderEmailHtml, renderEmailText } from '../brevo/email-template';

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

export function computePeriodEnd(months: BillingMonths): Date {
  return new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
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

      const existing = await this.prisma.subscription.findUnique({ where: { userId } });
      const currentPeriodEnd = computePeriodEnd(months);
      await this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: plan,
          status: 'active',
          paystackSubId: reference,
          currentPeriodEnd,
        },
        update: {
          tier: plan,
          status: 'active',
          currentPeriodEnd,
          expiryWarningSentAt: null,
        },
      });

      this.logger.log(`Subscription updated to ${plan} for user ${userId}`);
      // Complete referral if this is the user's first paid subscription
      await this.referrals.completeReferral(userId);

      // Only email once per distinct payment - a retried webhook or a
      // verify() call that arrives after the webhook already processed this
      // exact reference would otherwise double-send the confirmation.
      if (existing?.paystackSubId !== reference) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          void this.sendSubscriptionConfirmedEmail(user.email, user.name, plan, months, currentPeriodEnd);
        }
      }
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

    const existing = await this.prisma.subscription.findUnique({ where: { userId } });
    const currentPeriodEnd = computePeriodEnd(months);
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: plan,
        status: 'active',
        paystackSubId: reference,
        currentPeriodEnd,
      },
      update: {
        tier: plan,
        status: 'active',
        paystackSubId: reference,
        currentPeriodEnd,
        expiryWarningSentAt: null,
      },
    });

    this.logger.log(`Subscription activated (${plan}) for user ${userId} via verify - ref ${reference}`);
    await this.referrals.completeReferral(userId);

    if (existing?.paystackSubId !== reference) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        void this.sendSubscriptionConfirmedEmail(user.email, user.name, plan, months, currentPeriodEnd);
      }
    }

    return { success: true, tier: plan, type: 'subscription' };
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

  private async sendSubscriptionConfirmedEmail(
    email: string,
    name: string,
    plan: SubscriptionPlan,
    months: BillingMonths,
    currentPeriodEnd: Date,
  ): Promise<void> {
    const firstName = name.split(' ')[0];
    const planLabel = PLAN_LABELS[plan];
    const dashboardUrl = `${this.webUrl()}/dashboard`;
    const renewsOn = currentPeriodEnd.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
    const infoBox = `Plan: <strong>${planLabel}</strong> &middot; Billed for ${months} month${months === 1 ? '' : 's'} &middot; Renews ${renewsOn}`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: `You're on ${planLabel} - welcome aboard`,
        htmlContent: renderEmailHtml({
          eyebrow: 'Subscription Confirmed',
          heading: `You're on ${planLabel}, ${firstName}`,
          bodyHtml: [
            `Thanks for upgrading! Your <strong>${planLabel}</strong> subscription is active now - personalised stock picks, deep-dive research, and everything else that tier unlocks is ready in your dashboard.`,
          ],
          infoBox,
          button: { label: 'Go to Dashboard', url: dashboardUrl },
          siteUrl: this.webUrl(),
        }),
        textContent: renderEmailText({
          heading: `You're on ${planLabel}, ${firstName}`,
          bodyText: [
            `Thanks for upgrading! Your ${planLabel} subscription is active now (billed for ${months} month${months === 1 ? '' : 's'}, renews ${renewsOn}) - everything that tier unlocks is ready in your dashboard.`,
          ],
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

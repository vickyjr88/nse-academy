import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from '../referrals/referrals.service';
import { EbookService } from '../ebook/ebook.service';
import { BrevoService } from '../brevo/brevo.service';
import { computeEffectiveTier } from '../auth/effective-tier.util';

export type SubscriptionPlan = 'intermediary' | 'premium';

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  intermediary: 30000, // KSh 300 in kobo
  premium: 50000,      // KSh 500 in kobo
};

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

  async initializeTransaction(userId: string, email: string, plan: SubscriptionPlan = 'premium') {
    if (!PLAN_PRICES[plan]) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
    }

    if (!this.paystackSecret) {
      this.logger.error('PAYSTACK_SECRET_KEY is not configured');
      throw new InternalServerErrorException('Payment system configuration missing');
    }

    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: PLAN_PRICES[plan],
          callback_url: `${this.configService.get('WEB_URL', 'https://nseacademy.vitaldigitalmedia.net')}/payment/callback`,
          metadata: {
            type: 'subscription',
            userId,
            plan,
          },
        }),
      });

      const json = await response.json();
      if (!json.status) {
        this.logger.error(`Paystack initialization failed: ${json.message || 'Unknown error'}`);
        throw new Error(json.message || 'Paystack initialization failed');
      }

      return json.data; // { authorization_url, access_code, reference }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Paystack init error:', error.message);
        throw new InternalServerErrorException(`Payment system unavailable: ${error.message}`);
      }
      this.logger.error('Paystack init error:', error);
      throw new InternalServerErrorException('Payment system unavailable');
    }
  }

  async handleWebhook(body: any) {
    const event = body.event;
    const data = body.data;

    this.logger.log(`Received Paystack webhook event: ${event}`);

    try {
      if (event === 'charge.success') {
        const paymentType: string = data.metadata?.type || 'subscription';
        const userId = data.metadata?.userId;
        const reference = data.reference;

        if (paymentType === 'ebook') {
          const productId: string = data.metadata?.productId;
          const priceKes: number = data.metadata?.price_kes ?? 0;
          const email: string =
            data.metadata?.email || data.customer?.email || '';

          if (!productId) {
            this.logger.error('Ebook webhook missing productId');
            return { received: true };
          }
          if (!email && !userId) {
            this.logger.error('Ebook webhook missing email and userId');
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
            this.logger.error('No userId found in webhook metadata');
            return { received: true };
          }
          // --- Subscription payment (default) ---
          const plan: SubscriptionPlan = data.metadata.plan || 'premium';

          await this.prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              tier: plan,
              status: 'active',
              paystackSubId: reference,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
            update: {
              tier: plan,
              status: 'active',
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          this.logger.log(`Subscription updated to ${plan} for user ${userId}`);
          // Complete referral if this is the user's first paid subscription
          await this.referrals.completeReferral(userId);
        }
      }
    } catch (err) {
      this.logger.error(`Error processing webhook ${event}:`, err);
    }

    return { received: true };
  }

  /**
   * Unified verify endpoint - inspects Paystack metadata.type to determine
   * whether this is a subscription or ebook payment, then delegates accordingly.
   */
  async verifyAny(userId: string | null, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.paystackSecret}` },
    });
    const json = await response.json();

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

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.paystackSecret}` },
    });
    const json = await response.json();

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

    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier: plan,
        status: 'active',
        paystackSubId: reference,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        tier: plan,
        status: 'active',
        paystackSubId: reference,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    this.logger.log(`Subscription activated (${plan}) for user ${userId} via verify - ref ${reference}`);
    await this.referrals.completeReferral(userId);

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

  private async sendExpiryEmail(email: string, name: string): Promise<void> {
    const firstName = name.split(' ')[0];
    const upgradeUrl = `${this.webUrl()}/pricing`;
    try {
      await this.brevo.sendTransactional({
        to: { email, name },
        subject: 'Your NSE Academy subscription has expired',
        htmlContent: `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
  <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #047857; font-weight: 700; margin: 0 0 12px;">NSE Academy</p>
  <h1 style="font-size: 22px; margin: 0 0 12px;">Your subscription has expired, ${firstName}</h1>
  <p style="font-size: 16px; line-height: 1.6;">
    Your paid plan has ended and your account has moved to the free tier. You'll keep access to
    everything free tier includes, but premium features like personalised stock picks and deep-dive
    research are now paused.
  </p>
  <p style="margin: 28px 0;">
    <a href="${upgradeUrl}"
       style="display: inline-block; background: #047857; color: #fff; text-decoration: none;
              font-weight: 600; padding: 14px 28px; border-radius: 12px;">
      Renew your subscription
    </a>
  </p>
  <p style="font-size: 14px; color: #52525b; margin-top: 32px;">
    - The NSE Academy team
  </p>
</body></html>`,
        textContent: `Your subscription has expired, ${firstName}

Your paid plan has ended and your account has moved to the free tier. You'll keep access to everything free tier includes, but premium features like personalised stock picks and deep-dive research are now paused.

Renew your subscription: ${upgradeUrl}

- The NSE Academy team
`,
        tags: ['subscription-expired'],
      });
    } catch (err) {
      this.logger.error(`Failed to send subscription-expired email to ${email}: ${(err as Error).message}`);
    }
  }
}

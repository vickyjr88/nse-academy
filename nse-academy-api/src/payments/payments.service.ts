import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from '../referrals/referrals.service';
import { EbookService } from '../ebook/ebook.service';

export type SubscriptionPlan = 'intermediary' | 'premium';

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  intermediary: 10000, // KSh 100 in kobo
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
  ) {
    this.paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
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

        if (!userId) {
          this.logger.error('No userId found in webhook metadata');
          return { received: true };
        }

        if (paymentType === 'ebook') {
          // --- Ebook purchase ---
          const productId: string = data.metadata?.productId;
          const priceKes: number = data.metadata?.price_kes ?? 0;

          if (!productId) {
            this.logger.error('Ebook webhook missing productId');
            return { received: true };
          }

          await this.ebookService.activateFromWebhook(userId, productId, reference, priceKes);
          this.logger.log(`[Webhook] Ebook ${productId} activated for user ${userId}`);
        } else {
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
   * Unified verify endpoint — inspects Paystack metadata.type to determine
   * whether this is a subscription or ebook payment, then delegates accordingly.
   */
  async verifyAny(userId: string, reference: string) {
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

    const paymentType: string = json.data?.metadata?.type || 'subscription';

    if (paymentType === 'ebook') {
      // Delegate to ebook service
      const result = await this.ebookService.verifyAndActivate(userId, reference);
      return { ...result, type: 'ebook' };
    }

    // Default: subscription
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

    this.logger.log(`Subscription activated (${plan}) for user ${userId} via verify — ref ${reference}`);
    await this.referrals.completeReferral(userId);

    return { success: true, tier: plan, type: 'subscription' };
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    return sub || { tier: 'free', status: 'none' };
  }
}

import { Injectable, InternalServerErrorException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReferralsService } from '../referrals/referrals.service';

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
  ) {
    this.paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  async initializeTransaction(userId: string, email: string, plan: SubscriptionPlan = 'premium') {
    if (!PLAN_PRICES[plan]) {
      throw new BadRequestException(`Invalid plan: ${plan}`);
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
          callback_url: `${this.configService.get('WEB_URL', 'http://localhost:3010')}/dashboard/billing/verify`,
          metadata: {
            userId,
            plan,
          },
        }),
      });

      const json = await response.json();
      if (!json.status) {
        throw new Error(json.message || 'Paystack initialization failed');
      }

      return json.data; // { authorization_url, access_code, reference }
    } catch (error) {
      this.logger.error('Paystack init error:', error);
      throw new InternalServerErrorException('Payment system unavailable');
    }
  }

  async handleWebhook(body: any) {
    const event = body.event;
    const data = body.data;

    if (event === 'charge.success') {
      const userId = data.metadata.userId;
      const plan: SubscriptionPlan = data.metadata.plan || 'premium';
      const reference = data.reference;

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

    return { received: true };
  }

  async getSubscriptionStatus(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    return sub || { tier: 'free', status: 'none' };
  }
}

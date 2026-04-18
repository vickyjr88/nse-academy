import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackSecret: string;
  private readonly premiumPrice = 250000; // 2,500 KES in cents (Paystack uses kobo/cents)

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.paystackSecret = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  async initializeTransaction(userId: string, email: string) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.paystackSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          amount: this.premiumPrice,
          callback_url: `${this.configService.get('WEB_URL', 'http://localhost:3010')}/dashboard/billing/verify`,
          metadata: {
            userId,
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
    // In production, you'd verify the signature here
    const event = body.event;
    const data = body.data;

    if (event === 'charge.success') {
      const userId = data.metadata.userId;
      const reference = data.reference;

      // Update user subscription to premium
      await this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: 'premium',
          status: 'active',
          paystackSubId: reference,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
        update: {
          tier: 'premium',
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      this.logger.log(`Subscription updated for user ${userId}`);
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

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const EBOOK_PRICE_KES = 750;
const EBOOK_PRICE_KOBO = EBOOK_PRICE_KES * 100;

@Injectable()
export class EbookService {
  private readonly logger = new Logger(EbookService.name);
  private readonly paystackSecret: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.paystackSecret = this.config.get<string>('PAYSTACK_SECRET_KEY')!;
  }

  async initializePurchase(userId: string, email: string) {
    const existing = await this.prisma.ebookPurchase.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('You already own this ebook');

    const webUrl = this.config.get('WEB_URL', 'https://nseacademy.vitaldigitalmedia.net');
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: EBOOK_PRICE_KOBO,
        callback_url: `${webUrl}/payment/ebook-callback`,
        metadata: { userId, product: 'ebook', price_kes: EBOOK_PRICE_KES },
      }),
    });

    const json = await response.json();
    if (!json.status) throw new BadRequestException(json.message || 'Payment init failed');
    return json.data;
  }

  async verifyAndActivate(userId: string, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const existing = await this.prisma.ebookPurchase.findUnique({ where: { userId } });
    if (existing) return { success: true, alreadyOwned: true };

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.paystackSecret}` },
    });
    const json = await response.json();

    if (!json.status || json.data?.status !== 'success') {
      throw new BadRequestException(json.message || 'Payment not confirmed');
    }

    const metaUserId = json.data?.metadata?.userId;
    if (metaUserId && metaUserId !== userId) {
      throw new BadRequestException('Reference does not belong to this user');
    }

    await this.prisma.ebookPurchase.create({
      data: {
        userId,
        reference,
        amountKes: json.data?.metadata?.price_kes || EBOOK_PRICE_KES,
      },
    });

    this.logger.log(`Ebook purchased by user ${userId} — ref ${reference}`);
    return { success: true, alreadyOwned: false };
  }

  async getDownloadUrl(userId: string): Promise<{ url: string; filename: string }> {
    const purchase = await this.prisma.ebookPurchase.findUnique({ where: { userId } });
    if (!purchase) throw new BadRequestException('No ebook purchase found for this account');

    const downloadUrl = this.config.get<string>('EBOOK_DOWNLOAD_URL');
    if (!downloadUrl) throw new BadRequestException('Ebook download not configured');

    return { url: downloadUrl, filename: 'NSE_Complete_Investors_Guide_2026.pdf' };
  }

  async getStatus(userId: string) {
    const purchase = await this.prisma.ebookPurchase.findUnique({ where: { userId } });
    return { purchased: !!purchase, purchasedAt: purchase?.purchasedAt ?? null };
  }
}

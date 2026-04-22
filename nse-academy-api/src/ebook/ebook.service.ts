import { Injectable, BadRequestException, InternalServerErrorException, Logger, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

const DEXTER_DOWNLOAD_BASE = 'https://dexter-api.vitaldigitalmedia.net/api/external/download';

@Injectable()
export class EbookService {
  private readonly logger = new Logger(EbookService.name);
  private readonly paystackSecret: string;
  private readonly dexterApiKey: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.paystackSecret = this.config.get<string>('PAYSTACK_SECRET_KEY')!;
    this.dexterApiKey = this.config.get<string>('DEXTER_API_KEY')!;
  }

  async initializePurchase(userId: string, email: string, productId: string, priceKes: number) {
    const existing = await this.prisma.ebookPurchase.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) throw new BadRequestException('You already own this product');

    const webUrl = this.config.get('WEB_URL', 'https://nseacademy.vitaldigitalmedia.net');
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: priceKes * 100,
        callback_url: `${webUrl}/payment/ebook-callback`,
        metadata: { userId, product: 'ebook', productId, price_kes: priceKes },
      }),
    });

    const json = await response.json();
    if (!json.status) throw new BadRequestException(json.message || 'Payment init failed');
    return json.data;
  }

  async verifyAndActivate(userId: string, reference: string) {
    if (!reference) throw new BadRequestException('reference is required');

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${this.paystackSecret}` },
    });
    const json = await response.json();

    if (!json.status || json.data?.status !== 'success') {
      throw new BadRequestException(json.message || 'Payment not confirmed');
    }

    const metaUserId: string = json.data?.metadata?.userId;
    const productId: string = json.data?.metadata?.productId;
    const priceKes: number = json.data?.metadata?.price_kes;

    if (!productId) throw new BadRequestException('No product ID found in payment metadata');
    if (metaUserId && metaUserId !== userId) {
      throw new BadRequestException('Reference does not belong to this user');
    }

    const existing = await this.prisma.ebookPurchase.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) return { success: true, alreadyOwned: true };

    await this.prisma.ebookPurchase.create({
      data: { userId, productId, reference, amountKes: priceKes },
    });

    this.logger.log(`Product ${productId} purchased by user ${userId} — ref ${reference}`);
    return { success: true, alreadyOwned: false };
  }

  async download(userId: string, productId: string): Promise<StreamableFile> {
    const purchase = await this.prisma.ebookPurchase.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!purchase) throw new BadRequestException('No purchase found for this product');

    if (!this.dexterApiKey) {
      this.logger.error('DEXTER_API_KEY is not configured');
      throw new InternalServerErrorException('Download not configured');
    }

    const response = await fetch(
      `${DEXTER_DOWNLOAD_BASE}/${encodeURIComponent(productId)}`,
      { headers: { 'X-Access-Key': this.dexterApiKey } },
    );

    if (!response.ok) {
      this.logger.error(`Dexter API error: ${response.status} ${response.statusText}`);
      throw new InternalServerErrorException('Failed to retrieve file from storage');
    }

    const contentType = response.headers.get('content-type') ?? 'application/pdf';
    const disposition = response.headers.get('content-disposition') ?? `attachment; filename="${productId}.pdf"`;

    return new StreamableFile(Readable.fromWeb(response.body as any), { type: contentType, disposition });
  }

  async getStatus(userId: string) {
    const purchases = await this.prisma.ebookPurchase.findMany({
      where: { userId },
      select: { productId: true, purchasedAt: true },
    });
    return { purchases };
  }
}

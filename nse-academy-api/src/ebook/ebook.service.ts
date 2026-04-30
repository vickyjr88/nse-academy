import { Injectable, BadRequestException, InternalServerErrorException, Logger, StreamableFile } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

const DEXTER_DOWNLOAD_BASE = 'https://dexter-api.vitaldigitalmedia.net/api/external/download';

/**
 * Tier-based ebook access:
 *  - intermediary: only the NSE Trading Guide
 *  - premium: all ebooks (null = unrestricted)
 */
const TIER_EBOOK_ACCESS: Record<string, string[] | null> = {
  intermediary: ['4c379aa9-2035-47d8-b8fd-bacc860eea7c'],
  premium: null, // null = all ebooks
};

/** Check if a given tier grants free access to a specific product */
function tierGrantsAccess(tier: string, productId: string): boolean {
  const allowed = TIER_EBOOK_ACCESS[tier];
  if (allowed === undefined) return false; // tier not in map (e.g. 'free')
  if (allowed === null) return true;        // unrestricted (premium)
  return allowed.includes(productId);       // specific list (intermediary)
}

/** Get all product IDs a tier can access (null = all) */
function tierAccessibleProducts(tier: string): string[] | null {
  return TIER_EBOOK_ACCESS[tier] ?? undefined as unknown as null;
}

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

    // If user's subscription tier grants access to this specific ebook, no purchase needed
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (sub && sub.status === 'active' && tierGrantsAccess(sub.tier, productId)) {
      throw new BadRequestException('Your subscription already includes this ebook. Go to your library to download.');
    }

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
        callback_url: `${webUrl}/payment/callback`,
        metadata: { type: 'ebook', userId, productId, price_kes: priceKes },
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
    if (existing) return { success: true, alreadyOwned: true, type: 'ebook' };

    await this.prisma.ebookPurchase.create({
      data: { userId, productId, reference, amountKes: priceKes },
    });

    this.logger.log(`Product ${productId} purchased by user ${userId} — ref ${reference}`);
    return { success: true, alreadyOwned: false, type: 'ebook' };
  }

  /** Activate an ebook purchase via webhook (no userId validation needed — trusted server-side) */
  async activateFromWebhook(userId: string, productId: string, reference: string, priceKes: number) {
    const existing = await this.prisma.ebookPurchase.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) return; // already owned, nothing to do

    await this.prisma.ebookPurchase.create({
      data: { userId, productId, reference, amountKes: priceKes ?? 0 },
    });

    this.logger.log(`[Webhook] Product ${productId} activated for user ${userId} — ref ${reference}`);
  }

  /**
   * Download an ebook file.
   * Access is granted if:
   *  - The user has purchased the ebook (EbookPurchase record exists), OR
   *  - The user's subscription tier grants access to this specific product.
   */
  async download(userId: string, productId: string): Promise<StreamableFile> {
    const [purchase, subscription] = await Promise.all([
      this.prisma.ebookPurchase.findUnique({
        where: { userId_productId: { userId, productId } },
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);

    const hasPurchase = !!purchase;
    const hasEligibleSub =
      subscription &&
      subscription.status === 'active' &&
      tierGrantsAccess(subscription.tier, productId);

    if (!hasPurchase && !hasEligibleSub) {
      throw new BadRequestException('No purchase or eligible subscription found for this product');
    }

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
    const [purchases, subscription] = await Promise.all([
      this.prisma.ebookPurchase.findMany({
        where: { userId },
        select: { productId: true, purchasedAt: true },
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);

    const tier = subscription?.tier ?? 'free';
    const isActive = subscription?.status === 'active';
    const accessibleProductIds = isActive ? tierAccessibleProducts(tier) : undefined;

    return {
      purchases,
      subscriptionTier: tier,
      // null = all ebooks accessible (premium), string[] = specific IDs (intermediary), undefined = none (free)
      subscriberAccessProducts: accessibleProductIds ?? null,
    };
  }
}

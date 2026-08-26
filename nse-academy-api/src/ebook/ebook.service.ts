import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BrevoService } from '../brevo/brevo.service';
import { PaystackService } from '../paystack/paystack.service';
import { randomBytes } from 'crypto';
import {
  checkoutPathFor,
  MAX_GUEST_DOWNLOADS,
  subscriberAccessProducts,
  tierGrantsAccess,
} from './ebook-access';
import { InitializePurchaseDto } from './dto/initialize-purchase.dto';
import { Prisma } from '@prisma/client';

const DEXTER_DOWNLOAD_BASE =
  'https://dexter-api.vitaldigitalmedia.net/api/external/download';
const DEXTER_STOREFRONT_URL =
  'https://dexter-api.vitaldigitalmedia.net/api/products/storefront/51fe5af0-266b-419e-8559-3f0febcd74c4';

export interface EbookPurchaseResult {
  success: true;
  alreadyOwned: boolean;
  type: 'ebook';
  guestToken: string;
  productId: string;
  email: string;
}

interface DexterProductMeta {
  id: string;
  name: string;
}

@Injectable()
export class EbookService {
  private readonly logger = new Logger(EbookService.name);
  private readonly paystackSecret: string;
  private readonly dexterApiKey: string;
  private productCache: {
    fetchedAt: number;
    items: DexterProductMeta[];
  } | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private brevo: BrevoService,
    private paystack: PaystackService,
  ) {
    this.paystackSecret = this.config.get<string>('PAYSTACK_SECRET_KEY')!;
    this.dexterApiKey = this.config.get<string>('DEXTER_API_KEY')!;
  }

  private webUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  private newGuestToken(): string {
    return randomBytes(32).toString('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async initializePurchase(
    dto: InitializePurchaseDto,
    authUser?: { id: string; email: string } | null,
  ) {
    const productId = dto.productId;
    const priceKes = dto.priceKes;
    const email = this.normalizeEmail(authUser?.email || dto.email || '');
    const userId = authUser?.id ?? null;

    if (!email) {
      throw new BadRequestException(
        'Email is required to start checkout. Pay as a guest or log in.',
      );
    }

    if (userId) {
      const sub = await this.prisma.subscription.findUnique({
        where: { userId },
      });
      if (
        sub &&
        sub.status === 'active' &&
        tierGrantsAccess(sub.tier, productId)
      ) {
        return {
          alreadyIncluded: true,
          alreadyOwned: true,
          message:
            'Your subscription already includes this ebook. Download it from your library.',
        };
      }
    }

    const existing = await this.findExistingPurchase({
      userId,
      email,
      productId,
    });
    if (existing) {
      if (userId && !existing.userId) {
        await this.prisma.ebookPurchase.update({
          where: { id: existing.id },
          data: { userId },
        });
      }
      return {
        alreadyOwned: true,
        guestToken: existing.guestToken,
        productId: existing.productId,
        email: existing.email,
        message: 'You already own this ebook.',
      };
    }

    const json = await this.paystack.initializeTransaction({
      email,
      amountKobo: priceKes * 100,
      callbackUrl: `${this.webUrl()}/payment/callback`,
      metadata: {
        type: 'ebook',
        userId,
        productId,
        price_kes: priceKes,
        email,
        name: dto.name || undefined,
        guest: !userId,
      },
    });
    if (!json.status) {
      throw new BadRequestException(json.message || 'Payment init failed');
    }
    return json.data;
  }

  /**
   * Verify a Paystack reference and fulfill the ebook purchase. Works for both
   * authenticated users and guests (userId may be null).
   */
  async verifyAndActivate(
    reference: string,
    userId?: string | null,
  ): Promise<EbookPurchaseResult> {
    if (!reference) throw new BadRequestException('reference is required');

    const json = await this.verifyPaystack(reference);
    const meta = json.data?.metadata ?? {};
    const productId: string | undefined = meta.productId;
    const priceKes: number = Number(meta.price_kes ?? 0);
    const metaUserId: string | null = meta.userId || null;
    const email = this.normalizeEmail(
      meta.email || json.data?.customer?.email || '',
    );

    if (!productId) {
      throw new BadRequestException('No product ID found in payment metadata');
    }
    if (!email) {
      throw new BadRequestException('No email found on this payment');
    }
    if (metaUserId && userId && metaUserId !== userId) {
      throw new BadRequestException('Reference does not belong to this user');
    }

    return this.fulfillEbookPayment({
      reference,
      productId,
      priceKes,
      email,
      userId: userId || metaUserId,
    });
  }

  async activateFromWebhook(params: {
    userId?: string | null;
    email: string;
    productId: string;
    reference: string;
    priceKes: number;
  }): Promise<EbookPurchaseResult | void> {
    if (!params.productId) {
      this.logger.error('Ebook webhook missing productId');
      return;
    }
    const email = this.normalizeEmail(params.email || '');
    if (!email) {
      this.logger.error('Ebook webhook missing email');
      return;
    }
    return this.fulfillEbookPayment({
      reference: params.reference,
      productId: params.productId,
      priceKes: params.priceKes ?? 0,
      email,
      userId: params.userId,
    });
  }

  async fulfillEbookPayment(params: {
    reference: string;
    productId: string;
    priceKes: number;
    email: string;
    userId?: string | null;
  }): Promise<EbookPurchaseResult> {
    const email = this.normalizeEmail(params.email);
    let userId = params.userId || null;

    if (!userId) {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (user) userId = user.id;
    }

    const existingByRef = await this.prisma.ebookPurchase.findUnique({
      where: { reference: params.reference },
    });
    if (existingByRef) {
      if (userId && !existingByRef.userId) {
        await this.prisma.ebookPurchase.update({
          where: { id: existingByRef.id },
          data: { userId },
        });
      }
      void this.ensureEbookEmailed(existingByRef.id);
      return {
        success: true,
        alreadyOwned: true,
        type: 'ebook',
        guestToken: existingByRef.guestToken,
        productId: existingByRef.productId,
        email: existingByRef.email,
      };
    }

    const existingByOwner = await this.findExistingPurchase({
      userId,
      email,
      productId: params.productId,
    });
    if (existingByOwner) {
      if (userId && !existingByOwner.userId) {
        await this.prisma.ebookPurchase.update({
          where: { id: existingByOwner.id },
          data: { userId },
        });
      }
      void this.ensureEbookEmailed(existingByOwner.id);
      return {
        success: true,
        alreadyOwned: true,
        type: 'ebook',
        guestToken: existingByOwner.guestToken,
        productId: existingByOwner.productId,
        email: existingByOwner.email,
      };
    }

    const guestToken = this.newGuestToken();
    let purchase;
    try {
      purchase = await this.prisma.ebookPurchase.create({
        data: {
          userId,
          email,
          productId: params.productId,
          reference: params.reference,
          amountKes: params.priceKes ?? 0,
          guestToken,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raced = await this.prisma.ebookPurchase.findFirst({
          where: {
            OR: [
              { reference: params.reference },
              { email, productId: params.productId },
            ],
          },
        });
        if (raced) {
          void this.ensureEbookEmailed(raced.id);
          return {
            success: true,
            alreadyOwned: true,
            type: 'ebook',
            guestToken: raced.guestToken,
            productId: raced.productId,
            email: raced.email,
          };
        }
      }
      throw err;
    }

    this.logger.log(
      `Product ${params.productId} purchased by ${email}${userId ? ` (user ${userId})` : ' (guest)'} - ref ${params.reference}`,
    );
    void this.ensureEbookEmailed(purchase.id);
    return {
      success: true,
      alreadyOwned: false,
      type: 'ebook',
      guestToken: purchase.guestToken,
      productId: purchase.productId,
      email: purchase.email,
    };
  }

  /**
   * Attach any guest purchases for this email to the newly authenticated user.
   * Safe to call on every login / register / status fetch.
   */
  async claimPurchasesForEmail(userId: string, email: string): Promise<number> {
    const normalized = this.normalizeEmail(email);
    const guests = await this.prisma.ebookPurchase.findMany({
      where: { email: normalized, userId: null },
    });
    let claimed = 0;
    for (const guest of guests) {
      const owned = await this.prisma.ebookPurchase.findUnique({
        where: { userId_productId: { userId, productId: guest.productId } },
      });
      if (owned) {
        if (owned.id !== guest.id) {
          await this.prisma.ebookPurchase.delete({ where: { id: guest.id } });
        }
        continue;
      }
      await this.prisma.ebookPurchase.update({
        where: { id: guest.id },
        data: { userId },
      });
      claimed += 1;
    }
    if (claimed > 0) {
      this.logger.log(
        `Claimed ${claimed} guest ebook purchase(s) for user ${userId}`,
      );
    }
    return claimed;
  }

  /**
   * Download an ebook file.
   * Access is granted if:
   *  - The user has purchased the ebook, OR
   *  - The user's subscription tier grants access to this product.
   * Unpaid requests return 403 with a checkout path - never a generic error.
   */
  async download(userId: string, productId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.claimPurchasesForEmail(userId, user.email);
    }

    const [purchase, subscription] = await Promise.all([
      this.prisma.ebookPurchase.findUnique({
        where: { userId_productId: { userId, productId } },
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);

    const hasPurchase = !!purchase;
    const hasEligibleSub =
      !!subscription &&
      subscription.status === 'active' &&
      tierGrantsAccess(subscription.tier, productId);

    if (!hasPurchase && !hasEligibleSub) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: 'PURCHASE_REQUIRED',
          message: 'Purchase this ebook to download it.',
          productId,
          checkoutPath: checkoutPathFor(productId),
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return this.fetchDexterDownload(productId);
  }

  async getGuestAccessInfo(token: string) {
    if (!token) throw new BadRequestException('token is required');
    const purchase = await this.prisma.ebookPurchase.findUnique({
      where: { guestToken: token },
    });
    if (!purchase) {
      throw new NotFoundException(
        'This download link is invalid or has expired.',
      );
    }
    const limitReached = purchase.downloadCount >= MAX_GUEST_DOWNLOADS;
    return {
      valid: true,
      limitReached,
      productId: purchase.productId,
      email: purchase.email,
      downloadCount: purchase.downloadCount,
      maxDownloads: MAX_GUEST_DOWNLOADS,
      remainingDownloads: Math.max(
        0,
        MAX_GUEST_DOWNLOADS - purchase.downloadCount,
      ),
    };
  }

  async downloadByGuestToken(token: string): Promise<
    Record<string, unknown> & {
      productId: string;
      email: string;
      downloadCount: number;
      maxDownloads: number;
      remainingDownloads: number;
    }
  > {
    if (!token) throw new BadRequestException('token is required');
    const purchase = await this.prisma.ebookPurchase.findUnique({
      where: { guestToken: token },
    });
    if (!purchase) {
      throw new NotFoundException(
        'This download link is invalid or has expired.',
      );
    }

    if (purchase.downloadCount >= MAX_GUEST_DOWNLOADS) {
      throw this.downloadLimitError(purchase);
    }

    // Claim the slot atomically: updateMany with the count guard means two
    // concurrent requests on the same link can never both pass the limit.
    const claimed = await this.prisma.ebookPurchase.updateMany({
      where: {
        id: purchase.id,
        downloadCount: { lt: MAX_GUEST_DOWNLOADS },
      },
      data: {
        downloadCount: { increment: 1 },
        downloadedAt: new Date(),
      },
    });
    if (claimed.count === 0) {
      throw this.downloadLimitError({
        ...purchase,
        downloadCount: MAX_GUEST_DOWNLOADS,
      });
    }

    const downloadCount = purchase.downloadCount + 1;

    let file: Record<string, unknown>;
    try {
      file = await this.fetchDexterDownload(purchase.productId);
    } catch (err) {
      // The file never reached the buyer - give the slot back rather than
      // charging them a download for our own outage.
      await this.prisma.ebookPurchase
        .update({
          where: { id: purchase.id },
          data: { downloadCount: { decrement: 1 } },
        })
        .catch(() => undefined);
      throw err;
    }

    this.logger.log(
      `Guest download ${downloadCount}/${MAX_GUEST_DOWNLOADS} for ${purchase.email} - product ${purchase.productId}`,
    );

    return {
      ...file,
      productId: purchase.productId,
      email: purchase.email,
      downloadCount,
      maxDownloads: MAX_GUEST_DOWNLOADS,
      remainingDownloads: Math.max(0, MAX_GUEST_DOWNLOADS - downloadCount),
    };
  }

  private downloadLimitError(purchase: {
    productId: string;
    email: string;
    downloadCount: number;
  }): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'DOWNLOAD_LIMIT_REACHED',
        message: `This link has reached its limit of ${MAX_GUEST_DOWNLOADS} downloads. Log in - or create a free account - with ${purchase.email} to download your copy anytime.`,
        productId: purchase.productId,
        email: purchase.email,
        downloadCount: purchase.downloadCount,
        maxDownloads: MAX_GUEST_DOWNLOADS,
        remainingDownloads: 0,
      },
      HttpStatus.FORBIDDEN,
    );
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.claimPurchasesForEmail(userId, user.email);
    }

    const [purchases, subscription] = await Promise.all([
      this.prisma.ebookPurchase.findMany({
        where: { userId },
        select: { productId: true, purchasedAt: true, guestToken: true },
      }),
      this.prisma.subscription.findUnique({ where: { userId } }),
    ]);

    const tier = subscription?.tier ?? 'free';
    const isActive = subscription?.status === 'active';
    const accessProducts = subscriberAccessProducts(tier, isActive);

    return {
      purchases,
      subscriptionTier: tier,
      subscriptionActive: isActive,
      // null = all ebooks (premium), string[] = specific IDs (possibly empty)
      subscriberAccessProducts: accessProducts,
    };
  }

  private async findExistingPurchase(params: {
    userId: string | null;
    email: string;
    productId: string;
  }) {
    if (params.userId) {
      const byUser = await this.prisma.ebookPurchase.findUnique({
        where: {
          userId_productId: {
            userId: params.userId,
            productId: params.productId,
          },
        },
      });
      if (byUser) return byUser;
    }
    return this.prisma.ebookPurchase.findUnique({
      where: {
        email_productId: { email: params.email, productId: params.productId },
      },
    });
  }

  private async verifyPaystack(reference: string) {
    const json = await this.paystack.verifyTransaction(reference);
    if (!json.status || json.data?.status !== 'success') {
      throw new BadRequestException(json.message || 'Payment not confirmed');
    }
    return json;
  }

  private async fetchDexterDownload(productId: string) {
    if (!this.dexterApiKey) {
      this.logger.error('DEXTER_API_KEY is not configured');
      throw new InternalServerErrorException('Download not configured');
    }

    const response = await fetch(
      `${DEXTER_DOWNLOAD_BASE}/${encodeURIComponent(productId)}`,
      { headers: { 'X-Access-Key': this.dexterApiKey } },
    );

    if (!response.ok) {
      this.logger.error(
        `Dexter API error: ${response.status} ${response.statusText}`,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve file from storage',
      );
    }

    return response.json();
  }

  private async ensureEbookEmailed(purchaseId: string): Promise<void> {
    const purchase = await this.prisma.ebookPurchase.findUnique({
      where: { id: purchaseId },
    });
    if (!purchase || purchase.emailedAt) return;
    try {
      await this.sendEbookEmail(purchase);
      await this.prisma.ebookPurchase.update({
        where: { id: purchase.id },
        data: { emailedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Failed to email ebook ${purchase.productId} to ${purchase.email}: ${
          (err as Error).message
        }`,
      );
    }
  }

  private async sendEbookEmail(purchase: {
    email: string;
    productId: string;
    guestToken: string;
    userId: string | null;
  }): Promise<void> {
    const productName =
      (await this.lookupProductName(purchase.productId)) ||
      'your NSE Academy ebook';
    const accessUrl = `${this.webUrl()}/ebooks/access/${purchase.guestToken}`;
    const libraryUrl = `${this.webUrl()}/dashboard/downloads`;
    const registerUrl = `${this.webUrl()}/auth/register?redirectTo=${encodeURIComponent('/dashboard/downloads')}`;

    await this.brevo.sendTransactional({
      to: { email: purchase.email },
      subject: `Your ebook is ready: ${productName}`,
      htmlContent: this.renderEbookEmailHtml({
        productName,
        accessUrl,
        libraryUrl,
        registerUrl,
        hasAccount: Boolean(purchase.userId),
      }),
      textContent: this.renderEbookEmailText({
        productName,
        accessUrl,
        libraryUrl,
        registerUrl,
        hasAccount: Boolean(purchase.userId),
      }),
      tags: ['ebook-delivery', `product:${purchase.productId}`],
    });
  }

  private async lookupProductName(productId: string): Promise<string | null> {
    const now = Date.now();
    if (
      !this.productCache ||
      now - this.productCache.fetchedAt > 60 * 60 * 1000
    ) {
      try {
        const res = await fetch(DEXTER_STOREFRONT_URL);
        if (res.ok) {
          const json = await res.json();
          const items: DexterProductMeta[] = (json?.products ?? []).map(
            (p: { id: string; name: string }) => ({ id: p.id, name: p.name }),
          );
          this.productCache = { fetchedAt: now, items };
        }
      } catch (err) {
        this.logger.warn(
          `Could not load Dexter storefront for email names: ${(err as Error).message}`,
        );
      }
    }
    return (
      this.productCache?.items.find((p) => p.id === productId)?.name ?? null
    );
  }

  private renderEbookEmailHtml(opts: {
    productName: string;
    accessUrl: string;
    libraryUrl: string;
    registerUrl: string;
    hasAccount: boolean;
  }): string {
    const accountLine = opts.hasAccount
      ? `<p style="font-size: 14px; line-height: 1.6; color: #52525b;">
           Your account has unlimited downloads - grab it anytime from
           <a href="${opts.libraryUrl}" style="color: #047857;">your library</a>.
         </p>`
      : `<p style="font-size: 14px; line-height: 1.6; color: #52525b;">
           Need more than ${MAX_GUEST_DOWNLOADS} downloads?
           <a href="${opts.registerUrl}" style="color: #047857;">Create a free account</a>
           with this email and this ebook is yours to download anytime.
         </p>`;
    return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
  <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #047857; font-weight: 700; margin: 0 0 12px;">NSE Academy</p>
  <h1 style="font-size: 22px; margin: 0 0 12px;">Your ebook is ready</h1>
  <p style="font-size: 16px; line-height: 1.6;">
    Thanks for your purchase. Download <strong>${opts.productName}</strong> using the button below.
    This link is tied to your order and works for
    <strong>${MAX_GUEST_DOWNLOADS} downloads</strong> - keep this email so you can come back to it.
  </p>
  <p style="margin: 28px 0;">
    <a href="${opts.accessUrl}"
       style="display: inline-block; background: #047857; color: #fff; text-decoration: none;
              font-weight: 600; padding: 14px 28px; border-radius: 12px;">
      Download the PDF
    </a>
  </p>
  ${accountLine}
  <p style="font-size: 14px; color: #52525b; margin-top: 32px;">
    - The NSE Academy team<br/>
    <a href="${this.webUrl()}" style="color: #047857;">${this.webUrl().replace(/^https?:\/\//, '')}</a>
  </p>
</body></html>`;
  }

  private renderEbookEmailText(opts: {
    productName: string;
    accessUrl: string;
    libraryUrl: string;
    registerUrl: string;
    hasAccount: boolean;
  }): string {
    const accountLine = opts.hasAccount
      ? `Your account has unlimited downloads - grab it anytime from your library: ${opts.libraryUrl}`
      : `Need more than ${MAX_GUEST_DOWNLOADS} downloads? Create a free account with this email and this ebook is yours to download anytime: ${opts.registerUrl}`;
    return `Your ebook is ready: ${opts.productName}

Download: ${opts.accessUrl}

This link works for ${MAX_GUEST_DOWNLOADS} downloads, so keep this email.

${accountLine}

- The NSE Academy team
${this.webUrl()}
`;
  }
}

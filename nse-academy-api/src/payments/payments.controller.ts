import { Controller, Get, Post, Body, UseGuards, HttpCode, Headers, UnauthorizedException, Req, Logger, Query } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { PlayBillingService } from './play-billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { VerifyReferenceDto } from '../ebook/dto/verify-reference.dto';
import { AdminNotifierService } from '../admin-notifier/admin-notifier.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly playBilling: PlayBillingService,
    private readonly adminNotifier: AdminNotifierService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('payments/initialize')
  @ApiOperation({ summary: 'Initialize a Paystack payment for a given plan (intermediary | premium) and duration (1, 3, 6, or 12 months)' })
  async initialize(@Req() req, @Body() body: { plan?: 'intermediary' | 'premium'; months?: 1 | 3 | 6 | 12 }) {
    return this.paymentsService.initializeTransaction(req.user.id, req.user.email, body.plan ?? 'premium', body.months ?? 1);
  }

  @Post(['payments/webhook', 'api/webhooks/paystack', 'webhooks/paystack'])
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook listener (handles both subscription and ebook payments)' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      this.logger.error('PAYSTACK_SECRET_KEY not set, cannot verify webhook');
      throw new UnauthorizedException('Webhook verification unavailable');
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody || !signature) {
      this.logger.error('Webhook request missing raw body or signature header - rejecting');
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expectedHash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const expected = Buffer.from(expectedHash, 'utf8');
    const provided = Buffer.from(signature, 'utf8');
    const validSignature =
      expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
    if (!validSignature) {
      this.logger.error('Invalid Paystack signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      return await this.paymentsService.handleWebhook(body);
    } catch (err) {
      // Still rethrow so Paystack gets a non-2xx and retries; the alert is
      // for a human - the customer may have paid without getting access.
      void this.adminNotifier.webhookFailed({
        reference: body?.data?.reference,
        event: body?.event,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('payments/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Paystack reference and immediately activate subscription (legacy)' })
  async verify(@Req() req, @Body() body: VerifyReferenceDto) {
    return this.paymentsService.verifyAndActivate(req.user.id, body.reference);
  }

  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('payments/verify-any')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Unified verify - auto-detects subscription vs ebook. Auth optional for guest ebook purchases.',
  })
  async verifyAny(
    @Req() req: { user?: { id: string } },
    @Body() body: VerifyReferenceDto,
  ) {
    return this.paymentsService.verifyAny(req.user?.id ?? null, body.reference);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('payments/status')
  @ApiOperation({ summary: 'Get current subscription status' })
  async getStatus(@Req() req) {
    return this.paymentsService.getSubscriptionStatus(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('payments/google/config')
  @ApiOperation({ summary: 'Google Play Billing set-up for the signed-in member: whether it is on, the account id to attach to a purchase, and the product ids' })
  googleConfig(@Req() req) {
    return this.playBilling.appConfig(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('payments/google/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a Google Play subscription purchase token with Google and grant the plan' })
  googleVerify(@Req() req, @Body() body: { purchaseToken?: string }) {
    return this.playBilling.verify(req.user.id, body?.purchaseToken ?? '');
  }

  @Post('payments/google/notifications')
  @HttpCode(200)
  @ApiOperation({ summary: 'Google Play real-time developer notifications (Pub/Sub push); guarded by a shared token in the URL' })
  async googleNotifications(@Query('token') token: string, @Body() body: any) {
    if (!this.playBilling.checkNotificationToken(token)) throw new UnauthorizedException('Invalid notification token');
    try {
      return await this.playBilling.handleNotification(body);
    } catch (err) {
      this.logger.error(`Play notification failed: ${(err as Error).message}`);
      throw err; // a non-2xx makes Pub/Sub redeliver
    }
  }
}

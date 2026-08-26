import { Controller, Get, Post, Body, UseGuards, HttpCode, Headers, UnauthorizedException, Req, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { VerifyReferenceDto } from '../ebook/dto/verify-reference.dto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(private readonly paymentsService: PaymentsService) {}

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
    if (rawBody && signature) {
      const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
      if (hash !== signature) {
        this.logger.error('Invalid Paystack signature');
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
    return this.paymentsService.handleWebhook(body);
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
}

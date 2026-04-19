import { Controller, Get, Post, Body, UseGuards, HttpCode, Headers, UnauthorizedException, Req, Logger } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import * as crypto from 'crypto';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('payments/initialize')
  @ApiOperation({ summary: 'Initialize a Paystack payment for a given plan (intermediary | premium)' })
  async initialize(@Req() req, @Body() body: { plan?: 'intermediary' | 'premium' }) {
    return this.paymentsService.initializeTransaction(req.user.id, req.user.email, body.plan ?? 'premium');
  }

  @Post(['payments/webhook', 'api/webhooks/paystack', 'webhooks/paystack'])
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook listener' })
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
  @ApiOperation({ summary: 'Verify Paystack reference and immediately activate subscription' })
  async verify(@Req() req, @Body() body: { reference: string }) {
    return this.paymentsService.verifyAndActivate(req.user.id, body.reference);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('payments/status')
  @ApiOperation({ summary: 'Get current subscription status' })
  async getStatus(@Req() req) {
    return this.paymentsService.getSubscriptionStatus(req.user.id);
  }
}

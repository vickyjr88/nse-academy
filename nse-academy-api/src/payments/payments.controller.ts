import { Controller, Get, Post, Body, UseGuards, Request, HttpCode, Headers, UnauthorizedException, RawBodyRequest, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import * as crypto from 'crypto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  @ApiOperation({ summary: 'Initialize a Paystack payment for a given plan (intermediary | premium)' })
  async initialize(@Request() req, @Body() body: { plan?: 'intermediary' | 'premium' }) {
    return this.paymentsService.initializeTransaction(req.user.id, req.user.email, body.plan ?? 'premium');
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook listener' })
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const secret = process.env.PAYSTACK_SECRET_KEY ?? '';
    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (rawBody && signature) {
      const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
      if (hash !== signature) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
    return this.paymentsService.handleWebhook(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status')
  @ApiOperation({ summary: 'Get current subscription status' })
  async getStatus(@Request() req) {
    return this.paymentsService.getSubscriptionStatus(req.user.id);
  }
}

import { Controller, Get, Post, Body, UseGuards, Request, HttpCode } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  @ApiOperation({ summary: 'Initialize a Paystack payment' })
  async initialize(@Request() req) {
    return this.paymentsService.initializeTransaction(req.user.id, req.user.email);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook listener' })
  async webhook(@Body() body) {
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

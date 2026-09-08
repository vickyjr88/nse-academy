import { Body, Controller, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { BrevoWebhookService, BrevoWebhookEvent } from './brevo-webhook.service';

@Controller('webhooks/brevo')
export class BrevoWebhookController {
  private readonly logger = new Logger(BrevoWebhookController.name);

  constructor(
    private webhookService: BrevoWebhookService,
    private config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint() // not a public-facing API surface, no need to document it in Swagger
  async handle(@Query('key') key: string, @Body() body: BrevoWebhookEvent | BrevoWebhookEvent[]) {
    const expected = this.config.get<string>('BREVO_WEBHOOK_SECRET');
    if (!expected) {
      this.logger.error('BREVO_WEBHOOK_SECRET is not set - rejecting all webhook calls');
      throw new UnauthorizedException('Webhook not configured');
    }
    if (!key || !this.safeEqual(key, expected)) {
      throw new UnauthorizedException('Invalid webhook key');
    }
    // Always return 200 even on a processing quirk (e.g. no matching user) -
    // a non-2xx here makes Brevo retry indefinitely for an event that will
    // never resolve differently, unlike Paystack's payment webhook where a
    // transient DB error is worth retrying.
    return this.webhookService.handleEvent(body);
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}

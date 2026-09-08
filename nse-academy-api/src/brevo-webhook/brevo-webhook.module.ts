import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BrevoWebhookController } from './brevo-webhook.controller';
import { BrevoWebhookService } from './brevo-webhook.service';

@Module({
  imports: [PrismaModule],
  controllers: [BrevoWebhookController],
  providers: [BrevoWebhookService],
})
export class BrevoWebhookModule {}

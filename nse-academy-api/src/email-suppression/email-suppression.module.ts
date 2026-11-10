import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailSuppressionService } from './email-suppression.service';
import { EmailSuppressionController } from './email-suppression.controller';

/** Global so the Brevo sender and the webhook can both use it without importing this module. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [EmailSuppressionController],
  providers: [EmailSuppressionService],
  exports: [EmailSuppressionService],
})
export class EmailSuppressionModule {}

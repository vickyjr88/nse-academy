import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketingController } from './marketing.controller';
import { XService } from './x.service';
import { EncryptionService } from './encryption.service';
import { MarketReportService } from './market-report.service';
import { XComposeService } from './x-compose';
import { XAutomationService } from './x-automation.service';
import { XStreamService } from './x-stream.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MarketingController],
  providers: [XService, EncryptionService, MarketReportService, XComposeService, XAutomationService, XStreamService],
  exports: [XService, EncryptionService, MarketReportService],
})
export class MarketingModule {}

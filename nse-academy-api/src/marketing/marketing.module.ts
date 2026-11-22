import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketingController } from './marketing.controller';
import { XService } from './x.service';
import { EncryptionService } from './encryption.service';
import { MarketReportService } from './market-report.service';
import { SocialMediaCronService } from './social-media-cron.service';
import { SocialMediaMarketingCronService } from './social-media-marketing-cron.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MarketingController],
  providers: [XService, EncryptionService, MarketReportService, SocialMediaCronService, SocialMediaMarketingCronService],
  exports: [XService, EncryptionService, MarketReportService],
})
export class MarketingModule {}

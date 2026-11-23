import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MarketingController } from './marketing.controller';
import { XService } from './x.service';
import { EncryptionService } from './encryption.service';
import { MarketReportService } from './market-report.service';
import { XComposeService } from './x-compose';
import { XAutomationService } from './x-automation.service';
import { XStreamService } from './x-stream.service';
import { SocialPostService } from './social-post.service';
import { MetaService } from './meta.service';
import { TikTokService } from './tiktok.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [MarketingController],
  providers: [
    XService,
    EncryptionService,
    MarketReportService,
    XComposeService,
    XAutomationService,
    XStreamService,
    SocialPostService,
    MetaService,
    TikTokService,
  ],
  exports: [XService, EncryptionService, MarketReportService, SocialPostService],
})
export class MarketingModule {}

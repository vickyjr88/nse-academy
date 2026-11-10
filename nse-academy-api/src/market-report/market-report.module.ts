import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketFactsService } from './market-facts.service';
import { NarrativeService } from './narrative.service';
import { MarketReportService } from './market-report.service';
import { AdminMarketReportsController, PublicMarketReportsController } from './market-report.controller';
import { MarketDigestService } from './market-digest.service';
import { AdminDigestController, DigestController, PublicDigestController } from './digest.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicMarketReportsController, AdminMarketReportsController, DigestController, PublicDigestController, AdminDigestController],
  providers: [MarketFactsService, NarrativeService, MarketReportService, MarketDigestService],
  exports: [MarketFactsService],
})
export class MarketReportModule {}

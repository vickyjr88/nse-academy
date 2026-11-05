import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketFactsService } from './market-facts.service';
import { NarrativeService } from './narrative.service';
import { MarketReportService } from './market-report.service';
import { AdminMarketReportsController, PublicMarketReportsController } from './market-report.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PublicMarketReportsController, AdminMarketReportsController],
  providers: [MarketFactsService, NarrativeService, MarketReportService],
})
export class MarketReportModule {}

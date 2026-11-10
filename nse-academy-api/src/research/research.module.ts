import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketReportModule } from '../market-report/market-report.module';
import { ResearchService } from './research.service';
import { AdminResearchController, PublicResearchController } from './research.controller';

@Module({
  imports: [PrismaModule, MarketReportModule],
  controllers: [PublicResearchController, AdminResearchController],
  providers: [ResearchService],
  exports: [ResearchService],
})
export class ResearchModule {}

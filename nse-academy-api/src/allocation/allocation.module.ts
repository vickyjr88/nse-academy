import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketReportModule } from '../market-report/market-report.module';
import { AllocationService } from './allocation.service';
import { AllocationController } from './allocation.controller';
import { AdminPortfolioReviewController, PortfolioReviewService } from './portfolio-review.service';

@Module({
  imports: [PrismaModule, MarketReportModule],
  controllers: [AllocationController, AdminPortfolioReviewController],
  providers: [AllocationService, PortfolioReviewService],
  exports: [AllocationService],
})
export class AllocationModule {}

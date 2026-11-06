import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { MarketReportModule } from '../market-report/market-report.module';
import { AdminOpsController } from './admin-ops.controller';
import { AdminOpsService } from './admin-ops.service';
import { AdminHoldingsService } from './admin-holdings.service';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [PrismaModule, ReportsModule, MarketReportModule, JournalModule],
  controllers: [AdminOpsController],
  providers: [AdminOpsService, AdminHoldingsService],
})
export class AdminOpsModule {}

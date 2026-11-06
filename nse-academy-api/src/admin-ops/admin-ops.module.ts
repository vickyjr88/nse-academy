import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { MarketReportModule } from '../market-report/market-report.module';
import { AdminOpsController } from './admin-ops.controller';
import { AdminOpsService } from './admin-ops.service';

@Module({
  imports: [PrismaModule, ReportsModule, MarketReportModule],
  controllers: [AdminOpsController],
  providers: [AdminOpsService],
})
export class AdminOpsModule {}

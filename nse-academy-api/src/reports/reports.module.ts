import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DailyReportService } from './daily-report.service';
import { BusinessMetricsService } from './business-metrics.service';
import { SystemHealthService } from './system-health.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [DailyReportService, BusinessMetricsService, SystemHealthService],
  exports: [BusinessMetricsService, SystemHealthService],
})
export class ReportsModule {}

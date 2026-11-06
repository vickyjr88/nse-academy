import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobMonitorService } from './job-monitor.service';
import { AiUsageService } from './ai-usage.service';

/** Global so any service can record a job run or an AI call without wiring a module import. */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [JobMonitorService, AiUsageService],
  exports: [JobMonitorService, AiUsageService],
})
export class MonitoringModule {}

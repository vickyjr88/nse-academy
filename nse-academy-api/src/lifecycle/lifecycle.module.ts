import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleTriggerController } from './lifecycle-trigger.controller';
import { LifecycleService } from './lifecycle.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [LifecycleController, LifecycleTriggerController, AnalyticsController],
  providers: [LifecycleService, AnalyticsService],
})
export class LifecycleModule {}

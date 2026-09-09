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
  // LifecycleService is exported so other domain services (e.g.
  // ReferralsService) can record their own FlowEntry rows via its public
  // enterFlow/completeFlow methods, rather than duplicating that
  // bookkeeping or making FlowEntry writes go through a growing pile of
  // flow-specific methods on LifecycleService itself.
  exports: [LifecycleService],
})
export class LifecycleModule {}

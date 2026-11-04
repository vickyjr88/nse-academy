import { Global, Module } from '@nestjs/common';
import { AdminNotifierService } from './admin-notifier.service';

@Global()
@Module({
  providers: [AdminNotifierService],
  exports: [AdminNotifierService],
})
export class AdminNotifierModule {}

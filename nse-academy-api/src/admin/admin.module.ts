import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { CorporateModule } from '../corporate/corporate.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CorporateModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminAuthGuard],
})
export class AdminModule {}

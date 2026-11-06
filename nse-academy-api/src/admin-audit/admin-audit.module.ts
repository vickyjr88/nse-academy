import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { AdminAuditService } from './admin-audit.service';

/** Global so any service can add detail to the trail, and the interceptor covers every admin controller. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AdminAuditController],
  providers: [AdminAuditService, { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
  exports: [AdminAuditService],
})
export class AdminAuditModule {}

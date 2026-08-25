import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeadsController],
  providers: [LeadsService, AdminAuthGuard],
  exports: [LeadsService],
})
export class LeadsModule {}

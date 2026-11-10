import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AllocationModule } from '../allocation/allocation.module';
import { ModelPortfoliosService } from './model-portfolios.service';
import { AdminModelPortfoliosController, MemberModelPortfoliosController, PublicModelPortfoliosController } from './model-portfolios.controller';

@Module({
  imports: [PrismaModule, AllocationModule],
  controllers: [PublicModelPortfoliosController, MemberModelPortfoliosController, AdminModelPortfoliosController],
  providers: [ModelPortfoliosService],
  exports: [ModelPortfoliosService],
})
export class ModelPortfoliosModule {}

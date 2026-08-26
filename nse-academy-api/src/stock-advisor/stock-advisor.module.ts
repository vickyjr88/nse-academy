import { Module } from '@nestjs/common';
import { StockAdvisorController } from './stock-advisor.controller';
import { StockAdvisorService } from './stock-advisor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [StockAdvisorController],
  providers: [StockAdvisorService],
})
export class StockAdvisorModule {}

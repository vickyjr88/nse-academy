import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PortfolioWatchService } from './portfolio-watch.service';
import { AdminPortfolioWatchController, PortfolioWatchController } from './portfolio-watch.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PortfolioWatchController, AdminPortfolioWatchController],
  providers: [PortfolioWatchService],
  exports: [PortfolioWatchService],
})
export class PortfolioWatchModule {}

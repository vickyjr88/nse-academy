import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketDataModule } from '../market-data/market-data.module';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  imports: [PrismaModule, MarketDataModule],
  controllers: [JournalController],
  providers: [JournalService],
})
export class JournalModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  imports: [PrismaModule],
  controllers: [JournalController],
  providers: [JournalService],
})
export class JournalModule {}

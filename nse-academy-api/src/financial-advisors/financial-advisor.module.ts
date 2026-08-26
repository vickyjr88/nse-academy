import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CorporateModule } from '../corporate/corporate.module';
import { JournalModule } from '../journal/journal.module';
import { FinancialAdvisorController, FinancialAdvisorsPublicController } from './financial-advisor.controller';
import { FinancialAdvisorService } from './financial-advisor.service';

@Module({
  imports: [PrismaModule, CorporateModule, JournalModule],
  controllers: [FinancialAdvisorController, FinancialAdvisorsPublicController],
  providers: [FinancialAdvisorService],
})
export class FinancialAdvisorModule {}

import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { ReferralsModule } from '../referrals/referrals.module';
import { EbookModule } from '../ebook/ebook.module';

@Module({
  imports: [PrismaModule, ConfigModule, ReferralsModule, EbookModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

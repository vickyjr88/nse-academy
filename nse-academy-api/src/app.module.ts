import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfilerModule } from './profiler/profiler.module';
import { AdvisorModule } from './advisor/advisor.module';
import { PaymentsModule } from './payments/payments.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AdminModule } from './admin/admin.module';
import { EbookModule } from './ebook/ebook.module';
import { CorporateModule } from './corporate/corporate.module';
import { ContactModule } from './contact/contact.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketDataModule } from './market-data/market-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfilerModule,
    AdvisorModule,
    PaymentsModule,
    ReferralsModule,
    AdminModule,
    EbookModule,
    CorporateModule,
    ContactModule,
    MarketDataModule,
  ],
})
export class AppModule {}

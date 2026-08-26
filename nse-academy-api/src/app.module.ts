import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfilerModule } from './profiler/profiler.module';
import { AdvisorModule } from './advisor/advisor.module';
import { FinancialAdvisorModule } from './financial-advisors/financial-advisor.module';
import { PaymentsModule } from './payments/payments.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AdminModule } from './admin/admin.module';
import { EbookModule } from './ebook/ebook.module';
import { CorporateModule } from './corporate/corporate.module';
import { ContactModule } from './contact/contact.module';
import { LeadsModule } from './leads/leads.module';
import { BrevoModule } from './brevo/brevo.module';
import { PaystackModule } from './paystack/paystack.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketDataModule } from './market-data/market-data.module';
import { JournalModule } from './journal/journal.module';
import { BrokersModule } from './brokers/brokers.module';
import { AlertsModule } from './alerts/alerts.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProfilerModule,
    AdvisorModule,
    FinancialAdvisorModule,
    PaymentsModule,
    ReferralsModule,
    AdminModule,
    EbookModule,
    CorporateModule,
    ContactModule,
    BrevoModule,
    PaystackModule,
    LeadsModule,
    MarketDataModule,
    JournalModule,
    BrokersModule,
    AlertsModule,
    BroadcastModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

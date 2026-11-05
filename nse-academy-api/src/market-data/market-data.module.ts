import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { PublicMarketDataController } from './public-market-data.controller';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AlertsModule],
  controllers: [MarketDataController, PublicMarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}

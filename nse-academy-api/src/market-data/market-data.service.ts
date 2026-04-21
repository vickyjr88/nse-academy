import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Polls NSE stock data from RapidAPI.
   * Runs every 7 minutes (~8.5 times per hour), Mon-Fri, from 9:00 AM to 2:59 PM.
   */
  @Cron('0 */7 9-14 * * 1-5')
  async handleMarketPolling() {
    const start = Date.now();
    this.logger.log('Starting market data polling...');
    
    const apiKey = this.configService.get<string>('RAPID_API_KEY');
    if (!apiKey) {
      this.logger.error('RAPID_API_KEY not found in configuration. Polling skipped.');
      return;
    }

    try {
      const response = await axios.get('https://nairobi-stock-exchange-nse.p.rapidapi.com/stocks', {
        headers: {
          'x-rapidapi-host': 'nairobi-stock-exchange-nse.p.rapidapi.com',
          'x-rapidapi-key': apiKey,
        },
        timeout: 20000, // 20s timeout
      });

      if (response.data?.success && Array.isArray(response.data.data)) {
        const stocks = response.data.data;
        const timestamp = new Date();

        const dataToSave = stocks.map((s) => {
          // Parse price: handle "1,200.00" and "5.93 K"
          let rawPrice = (s.price || '0').replace(/,/g, '');
          let price = 0;
          
          if (rawPrice.includes(' K')) {
            price = parseFloat(rawPrice.replace(' K', '')) * 1000;
          } else {
            price = parseFloat(rawPrice);
          }

          return {
            ticker: s.ticker,
            name: s.name,
            price: price || 0,
            volume: s.volume || '0',
            change: s.change || '0%',
            timestamp,
          };
        });

        if (dataToSave.length > 0) {
          await this.prisma.stockPrice.createMany({
            data: dataToSave,
          });
          this.logger.log(`Successfully saved ${stocks.length} stock snapshots in ${Date.now() - start}ms.`);
        }
      } else {
        this.logger.warn('Market API returned success:false or invalid data structure.');
      }
    } catch (error) {
      this.logger.error(`Failed to poll market data: ${error.message}`);
      if (error.response) {
        this.logger.error(`Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`);
      }
    }
  }

  /**
   * Helper to fetch the latest prices for all tickers
   */
  async getLatestPrices() {
    // This is a common query pattern for this data
    return this.prisma.$queryRaw`
      SELECT DISTINCT ON (ticker) *
      FROM "StockPrice"
      ORDER BY ticker, timestamp DESC
    `;
  }

  /**
   * Helper to fetch the latest price for a specific ticker
   */
  async getLatestPriceForTicker(ticker: string) {
    const latest = await this.prisma.stockPrice.findFirst({
      where: {
        ticker: {
          equals: ticker,
          mode: 'insensitive',
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (!latest) {
      return null;
    }

    return latest;
  }
}


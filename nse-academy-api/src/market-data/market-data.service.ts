import { Injectable, Logger } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { JobMonitorService } from '../monitoring/job-monitor.service';
import { tracked } from '../monitoring/track';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import axios from 'axios';
import { DEFAULT_MAX_PER_HOUR, WINDOW_MS, parseRateLimit, pollDecision } from './poll-guard';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly alertsService: AlertsService,
    @Optional() private readonly monitor?: JobMonitorService,
  ) {}

  /** One row per poll attempt: the feed rate-limits (HTTP 429) about half of them, and that is invisible without this. */
  private note(startedAt: Date, ok: boolean, detail: string) {
    return this.monitor?.record('market-poll', ok ? { ok, startedAt, summary: detail } : { ok, startedAt, error: detail });
  }

  /** When each recent request to the provider was made. Seeded from the job log so a restart cannot cause a burst. */
  private sentAt: number[] | null = null;
  private warnedAboutLimit = false;

  private maxPerHour(): number {
    const n = Number(this.configService.get<string>('RAPID_API_MAX_REQUESTS_PER_HOUR'));
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_MAX_PER_HOUR;
  }

  private async recentRequests(): Promise<number[]> {
    if (this.sentAt === null) {
      try {
        const rows = await this.prisma.jobRun.findMany({ where: { job: 'market-poll', startedAt: { gt: new Date(Date.now() - WINDOW_MS) } }, select: { startedAt: true } });
        this.sentAt = rows.map((r) => r.startedAt.getTime());
      } catch {
        this.sentAt = [];
      }
    }
    const cutoff = Date.now() - WINDOW_MS;
    this.sentAt = this.sentAt.filter((t) => t > cutoff);
    return this.sentAt;
  }

  /**
   * Polls NSE stock data from RapidAPI. The timer ticks every minute from 09:00 to 15:59 Nairobi time, Mon-Fri (the NSE
   * trades 09:30-15:00), and a request goes out only when the provider's allowance (RAPID_API_MAX_REQUESTS_PER_HOUR,
   * default 4, the BASIC plan) has room and the last one was an even gap ago. Ticks that do not qualify do nothing.
   */
  @Cron('0 * 9-15 * * 1-5', { timeZone: 'Africa/Nairobi' })
  async handleMarketPolling() {
    const decision = pollDecision(await this.recentRequests(), Date.now(), this.maxPerHour());
    if (!decision.ok) return;
    await this.pollNow();
  }

  /** The admin's manual sync: ignores the even spacing but not the provider's limit. */
  async syncManually(): Promise<{ polled: boolean; message: string }> {
    const decision = pollDecision(await this.recentRequests(), Date.now(), this.maxPerHour(), false);
    if (!decision.ok) {
      return { polled: false, message: `The data plan allows ${this.maxPerHour()} requests an hour and they are used up. The next one is possible in about ${Math.ceil(decision.waitMs / 60_000)} minutes.` };
    }
    await this.pollNow();
    return { polled: true, message: 'Market data sync triggered' };
  }

  private async pollNow() {
    const start = Date.now();
    const startedAt = new Date(start);
    (this.sentAt ??= []).push(start);
    this.logger.log('Starting market data polling...');

    const apiKey = this.configService.get<string>('RAPID_API_KEY');
    if (!apiKey) {
      this.logger.error('RAPID_API_KEY not found in configuration. Polling skipped.');
      await this.note(startedAt, false, 'RAPID_API_KEY is not configured');
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
          await this.note(startedAt, true, `${stocks.length} snapshots`);

          await this.alertsService
            .checkAlertsForTickers(dataToSave.map((s) => ({ ticker: s.ticker, price: s.price })))
            .catch((err) => this.logger.error(`Alert check failed: ${err.message}`));
        }
      } else {
        this.logger.warn('Market API returned success:false or invalid data structure.');
        await this.note(startedAt, false, 'The market API returned an unusable response');
      }
    } catch (error) {
      this.logger.error(`Failed to poll market data: ${error.message}`);
      await this.note(startedAt, false, error.response?.status ? `HTTP ${error.response.status}` : String(error.message));
      if (error.response) {
        this.logger.error(`Status: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`);
        const limit = error.response.status === 429 ? parseRateLimit(error.response.data) : null;
        if (limit && !this.warnedAboutLimit && limit.limit < this.maxPerHour() * (limit.windowMinutes / 60)) {
          this.warnedAboutLimit = true;
          this.logger.warn(`The data provider's ${limit.plan ?? ''} plan allows only ${limit.limit} requests per ${limit.windowMinutes} minutes, less than the ${this.maxPerHour()} an hour this server is set to use. Set RAPID_API_MAX_REQUESTS_PER_HOUR to match.`);
        }
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


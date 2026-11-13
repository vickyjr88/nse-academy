import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';

const TICKER = /^[A-Za-z0-9.]{1,12}$/;

/**
 * The company pages on the public site show a latest-price card. They are read by
 * visitors (and crawlers) who have no login, so the card needs an endpoint that does
 * not ask for a JWT. Only the quote itself is exposed.
 */
@ApiTags('public-market-data')
@Controller('public/market-data')
export class PublicMarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  @ApiOperation({ summary: 'Latest delayed price of every listed NSE stock (no login)' })
  async list() {
    return this.marketData.listQuotes();
  }

  // Declared before ':ticker' only for readability; the paths do not overlap.
  @Get(':ticker/history')
  @Header('Cache-Control', 'public, max-age=300, s-maxage=900')
  @ApiOperation({ summary: 'Daily closing prices for one ticker, for charts (no login)' })
  async history(@Param('ticker') ticker: string, @Query('days') days?: string) {
    if (!TICKER.test(ticker)) throw new NotFoundException('Unknown ticker');
    const d = Math.min(Math.max(parseInt(days ?? '90', 10) || 90, 7), 400);
    const points = await this.marketData.getDailyHistory(ticker, d);
    if (points.length === 0) throw new NotFoundException('No price history for this ticker');
    return { ticker: ticker.toUpperCase(), days: d, points };
  }

  @Get(':ticker')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  @ApiOperation({ summary: 'Latest delayed price for one NSE ticker (no login)' })
  async quote(@Param('ticker') ticker: string) {
    if (!TICKER.test(ticker)) throw new NotFoundException('Unknown ticker');
    const latest = await this.marketData.getLatestPriceForTicker(ticker);
    if (!latest) throw new NotFoundException('No market data for this ticker');
    return {
      ticker: latest.ticker,
      name: latest.name,
      price: latest.price,
      change: latest.change,
      volume: latest.volume,
      updatedAt: latest.timestamp,
    };
  }
}

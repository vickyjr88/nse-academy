import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
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

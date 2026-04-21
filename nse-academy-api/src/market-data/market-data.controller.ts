import { Controller, Get, Post, UseGuards, Param, NotFoundException } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminAuthGuard } from '../admin/admin-auth.guard';

@ApiTags('market-data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) { }

  @Post('sync')
  @UseGuards(AdminAuthGuard)
  @ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
  @ApiOperation({ summary: 'Admin manually triggers the market data sync' })
  async triggerSync() {
    await this.marketDataService.handleMarketPolling();
    return { success: true, message: 'Market data sync successfully triggered' };
  }

  @Get('latest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the latest price snapshots for all listed companies' })
  async getLatest() {
    return this.marketDataService.getLatestPrices();
  }

  @Get(':ticker')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the latest price snapshot for a specific ticker' })
  async getLatestForTicker(@Param('ticker') ticker: string) {
    const data = await this.marketDataService.getLatestPriceForTicker(ticker);
    if (!data) {
      throw new NotFoundException(`No market data found for ticker: ${ticker}`);
    }
    return data;
  }
}


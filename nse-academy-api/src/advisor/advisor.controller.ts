import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('advisor')
@ApiBearerAuth()
@Controller('advisor')
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @UseGuards(JwtAuthGuard)
  @Get('recommendations')
  @ApiOperation({ summary: 'Get stock recommendations based on investor profile' })
  async getRecommendations(@Req() req: any) {
    return this.advisorService.getRecommendations(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('research')
  @ApiOperation({ summary: 'Research a specific NSE company — fit analysis by investor type' })
  @ApiQuery({ name: 'ticker', required: true, description: 'NSE ticker symbol e.g. SCOM, EQTY, KCB' })
  async research(@Req() req: any, @Query('ticker') ticker: string) {
    return this.advisorService.researchCompany(req.user.id, ticker);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tickers')
  @ApiOperation({ summary: 'List all available NSE company tickers for the research tool' })
  async tickers() {
    return this.advisorService.getAllTickers();
  }
}

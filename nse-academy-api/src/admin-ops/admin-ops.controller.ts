import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminOpsService } from './admin-ops.service';
import { AdminHoldingsService } from './admin-holdings.service';
import { CreateHoldingDto, UpdateHoldingDto } from './admin-holdings.dto';
import { UpdateTradeDto } from '../journal/dto/update-trade.dto';

const int = (v: string | undefined, fallback: number) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminOpsController {
  constructor(
    private ops: AdminOpsService,
    private holdings: AdminHoldingsService,
  ) {}

  /** Runs an edit and hands its before/after to the audit trail, which the interceptor writes when the request ends. */
  private async audited(req: { audit?: unknown }, run: () => Promise<{ result: unknown; audit: unknown }>) {
    const { result, audit } = await run();
    req.audit = audit;
    return result;
  }

  @Get('payments')
  payments(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.ops.payments(int(page, 1), int(limit, 25));
  }

  @Get('subscriptions')
  subscriptions(
    @Query('tier') tier?: string,
    @Query('status') status?: string,
    @Query('expiringWithinDays') expiring?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    for (const [name, v, allowed] of [['tier', tier, ['free', 'intermediary', 'premium']], ['status', status, ['active', 'cancelled', 'past_due']]] as const) {
      if (v && !(allowed as readonly string[]).includes(v)) throw new BadRequestException(`${name} must be one of ${allowed.join(', ')}`);
    }
    return this.ops.subscriptions({ tier, status, expiringWithinDays: expiring ? int(expiring, 0) || undefined : undefined, page: int(page, 1), limit: int(limit, 25) });
  }

  @Get('market-reports')
  marketReports(@Query('limit') limit?: string) {
    return this.ops.marketReports(int(limit, 60));
  }

  @Get('users/:id/portfolio')
  userPortfolio(@Param('id') id: string) {
    return this.ops.userPortfolio(id);
  }

  @Get('system/health')
  systemHealth() {
    return this.ops.systemHealth();
  }

  @Get('system/jobs')
  jobs(@Query('job') job?: string, @Query('limit') limit?: string) {
    return this.ops.recentJobRuns(job, int(limit, 50));
  }

  @Get('system/ai-calls')
  aiCalls(@Query('feature') feature?: string, @Query('limit') limit?: string) {
    return this.ops.aiCalls(feature, int(limit, 50));
  }

  @Post('users/:userId/holdings')
  addHolding(@Req() req: any, @Param('userId') userId: string, @Body() body: CreateHoldingDto) {
    return this.audited(req, () => this.holdings.create(userId, body));
  }

  @Put('users/:userId/holdings/:holdingId')
  editHolding(@Req() req: any, @Param('userId') userId: string, @Param('holdingId') holdingId: string, @Body() body: UpdateHoldingDto) {
    return this.audited(req, () => this.holdings.update(userId, holdingId, body));
  }

  @Delete('users/:userId/holdings/:holdingId')
  deleteHolding(@Req() req: any, @Param('userId') userId: string, @Param('holdingId') holdingId: string) {
    return this.audited(req, () => this.holdings.remove(userId, holdingId));
  }

  @Put('users/:userId/trades/:tradeId')
  editTrade(@Req() req: any, @Param('userId') userId: string, @Param('tradeId') tradeId: string, @Body() body: UpdateTradeDto) {
    return this.audited(req, () => this.holdings.updateTrade(userId, tradeId, body));
  }

  @Delete('users/:userId/trades/:tradeId')
  deleteTrade(@Req() req: any, @Param('userId') userId: string, @Param('tradeId') tradeId: string) {
    return this.audited(req, () => this.holdings.deleteTrade(userId, tradeId));
  }
}

import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('flows')
  @ApiOperation({ summary: 'Per-flow entered/sent/failed/pending/skipped counts' })
  @ApiQuery({ name: 'sinceDays', required: false, description: 'Only count entries from the last N days; omit for all-time' })
  getFlowSummaries(@Query('sinceDays') sinceDays?: string) {
    const since = sinceDays ? new Date(Date.now() - parseInt(sinceDays, 10) * 24 * 60 * 60 * 1000) : undefined;
    return this.analytics.getFlowSummaries(since);
  }

  @Get('funnel/signup')
  @ApiOperation({ summary: 'Signed up -> Day 1 -> Day 7 -> Day 14 -> engaged -> paid funnel' })
  getSignupFunnel() {
    return this.analytics.getSignupFunnel();
  }

  @Get('funnel/churn-recovery')
  @ApiOperation({ summary: 'Lapsed -> renewal nudge -> win-back -> reactivated funnel' })
  getChurnRecoveryFunnel() {
    return this.analytics.getChurnRecoveryFunnel();
  }

  @Get('daily-volume')
  @ApiOperation({ summary: 'Daily entered/sent counts per flow, for a time-series chart' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  getDailyVolume(@Query('days') days?: string) {
    return this.analytics.getDailyVolume(days ? parseInt(days, 10) : undefined);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Broadcast campaign send history and totals' })
  getCampaignReport() {
    return this.analytics.getCampaignReport();
  }

  @Get('variants/:flow')
  @ApiOperation({ summary: 'A/B variant results (sent/opened/clicked/converted) for day14-nurture or winback' })
  @ApiParam({ name: 'flow', enum: ['day14-nurture', 'winback'] })
  getVariantResults(@Param('flow') flow: string) {
    if (flow !== 'day14-nurture' && flow !== 'winback') {
      throw new BadRequestException('Only day14-nurture and winback have A/B variants');
    }
    return this.analytics.getVariantResults(flow);
  }
}

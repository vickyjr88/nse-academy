import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ActivityService, nairobiYmd } from '../activity/activity.service';
import { AnalyticsService } from './analytics.service';

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin/analytics')
export class AnalyticsAdminController {
  constructor(
    private analytics: AnalyticsService,
    private activity: ActivityService,
  ) {}

  /** Website visitors, page views, sources, campaigns and attributed signups for the last N days (default 30). */
  @Get('traffic')
  traffic(@Query('days') days?: string) {
    return this.analytics.report(parseInt(days ?? '30', 10) || 30);
  }

  /** Active members (daily / weekly / monthly), stickiness, a 30-day series, and paying members who have gone quiet. */
  @Get('members')
  members() {
    return this.activity.metrics(nairobiYmd(new Date()));
  }
}

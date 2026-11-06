import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminOpsService } from './admin-ops.service';

const int = (v: string | undefined, fallback: number) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminOpsController {
  constructor(private ops: AdminOpsService) {}

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
}

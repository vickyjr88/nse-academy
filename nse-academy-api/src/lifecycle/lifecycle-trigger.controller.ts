import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { LifecycleService } from './lifecycle.service';

/**
 * Manual backfill trigger for the signup-nurture flows (day1/7/14), kept as
 * its own controller (separate from LifecycleController's tag CRUD) since
 * it's a distinct admin concern - "run this flow against existing users
 * right now" rather than "manage segments."
 */
@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin/lifecycle')
export class LifecycleTriggerController {
  constructor(private lifecycle: LifecycleService) {}

  @Get('trigger/:flow/preview')
  @ApiOperation({ summary: 'Preview how many existing users would receive this flow if triggered now' })
  @ApiParam({ name: 'flow', enum: ['day1-nurture', 'day7-nurture', 'day14-nurture'] })
  preview(@Param('flow') flow: string) {
    return this.lifecycle.previewManualTrigger(flow);
  }

  @Post('trigger/:flow')
  @ApiOperation({ summary: 'Manually run a signup-nurture flow against every currently-eligible existing user, ignoring signup date' })
  @ApiParam({ name: 'flow', enum: ['day1-nurture', 'day7-nurture', 'day14-nurture'] })
  trigger(@Param('flow') flow: string) {
    return this.lifecycle.triggerManually(flow);
  }
}

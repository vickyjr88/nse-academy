import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Combined analytics overview' })
  getAnalytics() {
    return this.admin.getAnalytics();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.admin.listUsers(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get full user detail including investorProfile and subscription' })
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users/:id/subscription')
  @ApiOperation({ summary: 'Create or upsert subscription (bypasses Paystack)' })
  upsertSubscription(
    @Param('id') id: string,
    @Body() dto: UpsertSubscriptionDto,
  ) {
    return this.admin.upsertSubscription(id, dto);
  }

  @Delete('users/:id/subscription')
  @ApiOperation({ summary: 'Cancel subscription (sets status to cancelled)' })
  cancelSubscription(@Param('id') id: string) {
    return this.admin.cancelSubscription(id);
  }
}

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
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('tier') tier?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.admin.listUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      tier,
      status,
      sortBy,
      sortOrder,
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get full user detail including investorProfile and subscription' })
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Get('ebook-purchases')
  @ApiOperation({ summary: 'List all ebook purchases (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  listEbookPurchases(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.admin.listEbookPurchases({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
    });
  }

  @Get('investor-profiles')
  @ApiOperation({ summary: 'List all investor profiles (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'capitalRange', required: false })
  listInvestorProfiles(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('capitalRange') capitalRange?: string,
  ) {
    return this.admin.listInvestorProfiles({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      type,
      capitalRange,
    });
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

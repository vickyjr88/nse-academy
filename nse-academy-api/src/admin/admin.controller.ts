import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { UpsertSubscriptionDto } from './dto/upsert-subscription.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpsertLicenseDto } from './dto/upsert-license.dto';

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

  @Get('ebook-purchases/:id')
  @ApiOperation({ summary: 'Get full ebook purchase detail including buyer and download history' })
  getEbookPurchase(@Param('id') id: string) {
    return this.admin.getEbookPurchase(id);
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

  @Get('investor-profiles/:id')
  @ApiOperation({ summary: 'Get full investor profile detail including quiz answers' })
  getInvestorProfile(@Param('id') id: string) {
    return this.admin.getInvestorProfile(id);
  }

  @Get('lesson-progress')
  @ApiOperation({ summary: 'List all lesson progresses (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'completed', required: false })
  listLessonProgresses(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('completed') completed?: string,
  ) {
    return this.admin.listLessonProgresses({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      completed,
    });
  }

  @Get('lesson-progress/:id')
  @ApiOperation({ summary: 'Get a single lesson progress record' })
  getLessonProgress(@Param('id') id: string) {
    return this.admin.getLessonProgress(id);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List all organizations (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', required: false })
  listOrganizations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.admin.listOrganizations({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      type,
    });
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get full organization detail including license and members' })
  getOrganization(@Param('id') id: string) {
    return this.admin.getOrganization(id);
  }

  @Post('organizations')
  @ApiOperation({ summary: 'Create an organization with an offline (or paystack) seat-pack license' })
  createOrganization(@Body() dto: CreateOrganizationDto) {
    return this.admin.createOrganizationWithLicense(dto);
  }

  @Put('organizations/:id/license')
  @ApiOperation({ summary: "Create or update an organization's license (seats, price, payment method)" })
  upsertOrganizationLicense(@Param('id') id: string, @Body() dto: UpsertLicenseDto) {
    return this.admin.upsertOrganizationLicense(id, dto);
  }

  @Get('advisors')
  @ApiOperation({ summary: 'List financial advisors (paginated), filterable by approval status' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, description: 'pending | approved | suspended' })
  listAdvisors(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listAdvisors({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      status,
    });
  }

  @Get('advisors/:id')
  @ApiOperation({ summary: 'Get full advisor detail including client/query/insight/alert counts' })
  getAdvisor(@Param('id') id: string) {
    return this.admin.getAdvisor(id);
  }

  @Post('advisors/:id/approve')
  @ApiOperation({ summary: 'Approve a pending or suspended advisor profile' })
  approveAdvisor(@Param('id') id: string) {
    return this.admin.approveAdvisor(id);
  }

  @Post('advisors/:id/suspend')
  @ApiOperation({ summary: 'Suspend an advisor profile' })
  suspendAdvisor(@Param('id') id: string) {
    return this.admin.suspendAdvisor(id);
  }

  @Get('referrals')
  @ApiOperation({ summary: 'List all referrals (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false })
  listReferrals(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.admin.listReferrals({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
    });
  }

  @Get('referrals/:id')
  @ApiOperation({ summary: 'Get full referral detail including referrer and referred users' })
  getReferral(@Param('id') id: string) {
    return this.admin.getReferral(id);
  }

  @Get('contact-submissions')
  @ApiOperation({ summary: 'List all contact submissions (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false })
  listContactSubmissions(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    return this.admin.listContactSubmissions({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
    });
  }

  @Get('contact-submissions/:id')
  @ApiOperation({ summary: 'Get a single contact submission with its full message' })
  getContactSubmission(@Param('id') id: string) {
    return this.admin.getContactSubmission(id);
  }

  @Get('stock-prices')
  @ApiOperation({ summary: 'Latest price for every ticker (one row per counter)' })
  listStockPrices() {
    return this.admin.listStockPrices();
  }

  @Get('stock-prices/:ticker/history')
  @ApiOperation({ summary: 'Price history for a single ticker over the last 30 days' })
  getStockPriceHistory(@Param('ticker') ticker: string) {
    return this.admin.getStockPriceHistory(ticker);
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

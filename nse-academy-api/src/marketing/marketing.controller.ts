import { Controller, Post, Get, Put, Param, Body, UseGuards, HttpCode, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ConfigService } from '@nestjs/config';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { XService } from './x.service';
import { MarketReportService } from './market-report.service';
import { XAutomationService } from './x-automation.service';
import { XStreamService } from './x-stream.service';
import { SocialPostService } from './social-post.service';
import { fillReportPost } from './x-slot';
import { publicSiteUrl } from '../site-url';
import { SOCIAL_PLATFORMS, TIKTOK_PRIVACY_LEVELS } from './x-automation.config';

// Keys copied from the X console often carry a trailing space or newline, which makes X answer 401.
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// The global ValidationPipe uses whitelist: true, which strips every property that has no validator decorator.
class StoreXCredentialsDto {
  @trim() @IsString() @IsNotEmpty() accountName: string;
  @trim() @IsString() @IsNotEmpty() apiKey: string;
  @trim() @IsString() @IsNotEmpty() apiSecret: string;
  @trim() @IsString() @IsNotEmpty() accessToken: string;
  @trim() @IsString() @IsNotEmpty() accessTokenSecret: string;
  @trim() @IsOptional() @IsString() bearerToken?: string;
}

class UpdateXCredentialsDto {
  @trim() @IsOptional() @IsString() accountName?: string;
  @trim() @IsOptional() @IsString() apiKey?: string;
  @trim() @IsOptional() @IsString() apiSecret?: string;
  @trim() @IsOptional() @IsString() accessToken?: string;
  @trim() @IsOptional() @IsString() accessTokenSecret?: string;
  @trim() @IsOptional() @IsString() bearerToken?: string;
}

class StoreSocialCredentialsDto {
  @IsIn(SOCIAL_PLATFORMS) platform: (typeof SOCIAL_PLATFORMS)[number];
  @trim() @IsString() @IsNotEmpty() accountName: string;
  @trim() @IsOptional() @IsString() externalId?: string;
  @trim() @ValidateIf((o) => o.platform === 'x') @IsString() @IsNotEmpty() apiKey?: string;
  @trim() @ValidateIf((o) => o.platform === 'x') @IsString() @IsNotEmpty() apiSecret?: string;
  @trim() @IsString() @IsNotEmpty() accessToken: string;
  @trim() @ValidateIf((o) => o.platform === 'x') @IsString() @IsNotEmpty() accessTokenSecret?: string;
  @trim() @IsOptional() @IsString() refreshToken?: string;
  @trim() @IsOptional() @IsString() bearerToken?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

class UpdateSocialCredentialsDto {
  @trim() @IsOptional() @IsString() accountName?: string;
  @trim() @IsOptional() @IsString() externalId?: string;
  @trim() @IsOptional() @IsString() apiKey?: string;
  @trim() @IsOptional() @IsString() apiSecret?: string;
  @trim() @IsOptional() @IsString() accessToken?: string;
  @trim() @IsOptional() @IsString() accessTokenSecret?: string;
  @trim() @IsOptional() @IsString() refreshToken?: string;
  @trim() @IsOptional() @IsString() bearerToken?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

class PlatformTargetDto {
  @IsIn(SOCIAL_PLATFORMS) platform: (typeof SOCIAL_PLATFORMS)[number];
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsString() credentialId?: string | null;
  @IsOptional() @IsString() suffix?: string;
  @IsOptional() @IsString() hashtags?: string;
  @IsOptional() @IsIn(TIKTOK_PRIVACY_LEVELS) tiktokPrivacy?: (typeof TIKTOK_PRIVACY_LEVELS)[number];
}

class PostToPlatformDto {
  @IsIn(SOCIAL_PLATFORMS) platform: (typeof SOCIAL_PLATFORMS)[number];
  @IsString() @IsNotEmpty() credentialId: string;
  @IsString() @IsNotEmpty() content: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mediaUrls?: string[];
  @IsOptional() @IsString() reportId?: string;
}

class SlotDto {
  @IsString() @IsNotEmpty() id: string;
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(23) hour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1439) atMinute?: number;
  @IsString() @IsNotEmpty() template: string;
}

class StreamRuleDto {
  @IsString() @IsNotEmpty() tag: string;
  @IsString() @IsNotEmpty() value: string;
}

class AutomationConfigDto {
  @IsBoolean() enabled: boolean;
  @IsIn(['draft', 'live']) mode: 'draft' | 'live';
  @IsOptional() @IsString() credentialId?: string | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlatformTargetDto) platforms?: PlatformTargetDto[];
  @IsArray() @IsInt({ each: true }) days: number[];
  @IsInt() @Min(0) @Max(1439) startMinute: number;
  @IsInt() @Min(0) @Max(1439) endMinute: number;
  @IsInt() @Min(0) @Max(24) maxPostsPerDay: number;
  @IsInt() @Min(0) minGapMinutes: number;
  @IsBoolean() skipIfUnchanged: boolean;
  @IsBoolean() aiCompose: boolean;
  @IsNumber() @Min(0) @Max(20) moverThresholdPct: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SlotDto) slots: SlotDto[];
  @IsArray() @IsString({ each: true }) lessons: string[];
  @IsArray() @IsString({ each: true }) spotlightTickers: string[];
  @IsBoolean() streamEnabled: boolean;
  @IsArray() @ValidateNested({ each: true }) @Type(() => StreamRuleDto) streamRules: StreamRuleDto[];
  @IsInt() @Min(0) streamDailyPostCap: number;
  @IsNumber() @Min(0) streamMonthlyUsdCap: number;
  @IsNumber() @Min(0) streamUnitUsd: number;
}

class PostToXDto {
  @IsString() @IsNotEmpty() credentialId: string;
  @IsString() @IsNotEmpty() content: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mediaUrls?: string[];
  @IsOptional() @IsString() reportId?: string;
}

class PostReportToXDto {
  @IsString() @IsNotEmpty() credentialId: string;
  @IsDateString() reportDate: string; // YYYY-MM-DD format
}

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(
    private xService: XService,
    private marketReportService: MarketReportService,
    private automation: XAutomationService,
    private stream: XStreamService,
    private social: SocialPostService,
    private config: ConfigService,
  ) {}

  @Post('x/credentials')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Store or update X API credentials' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Credentials stored successfully' })
  async storeXCredentials(@Body() dto: StoreXCredentialsDto) {
    return this.xService.storeCredentials(dto.accountName, {
      apiKey: dto.apiKey,
      apiSecret: dto.apiSecret,
      accessToken: dto.accessToken,
      accessTokenSecret: dto.accessTokenSecret,
      bearerToken: dto.bearerToken,
    });
  }

  @Post('x/test/:credentialId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Test X API credentials' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Credentials tested' })
  async testXCredentials(@Param('credentialId') credentialId: string) {
    return this.xService.testCredentials(credentialId);
  }

  @Post('x/post')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Post content to X' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Post published successfully' })
  async postToX(@Body() dto: PostToXDto) {
    return this.xService.postToX(
      dto.credentialId,
      dto.content,
      dto.mediaUrls,
      dto.reportId,
    );
  }

  @Post('x/report')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Post market report to X with card images' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Report posted to X successfully' })
  async postReportToX(@Body() dto: PostReportToXDto) {
    const report = await this.marketReportService.getReportForXPosting(dto.reportDate);
    const site = publicSiteUrl((key) => this.config.get<string>(key));
    const verified = fillReportPost((report.social as { xPost?: string } | null)?.xPost, dto.reportDate, site);
    const fallback = this.marketReportService.createXPosts({
      title: '',
      date: dto.reportDate,
      summary: '',
      keyStats: { stocksUp: 0, stocksDown: 0, valueTraded: '', stocksTraded: 0 },
      topMovers: { gainers: [], losers: [] },
      cardImageUrls: report.cardImageUrls,
    });

    const result = await this.xService.postReportToX(
      dto.credentialId,
      verified ?? fallback[0],
      report.cardImageUrls,
      dto.reportDate,
    );

    // Mark report as posted
    await this.marketReportService.markAsPostedToX(dto.reportDate, result.postId);

    return result;
  }

  @Post('x/resend/:postId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend a previously published post to X' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Post resent successfully' })
  async resendPost(@Param('postId') postId: string) {
    return this.xService.resendPost(postId);
  }

  @Put('x/credentials/:credentialId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Edit an X account; only the fields provided are changed' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Account updated' })
  async updateXCredentials(@Param('credentialId') credentialId: string, @Body() dto: UpdateXCredentialsDto) {
    return this.xService.updateCredential(credentialId, dto);
  }

  @Delete('x/credentials/:credentialId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an X account and its post history' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteXCredentials(@Param('credentialId') credentialId: string) {
    await this.xService.deleteCredential(credentialId);
    return { success: true, message: 'Account deleted' };
  }

  @Delete('x/failed-posts')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove every failed attempt from the post history' })
  @ApiBearerAuth()
  async clearFailedPosts() {
    return this.xService.clearFailedPosts('x');
  }

  @Delete('x/posts/:postId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove one entry from the post history (the post on X is not deleted)' })
  @ApiBearerAuth()
  async deletePost(@Param('postId') postId: string) {
    await this.xService.deletePost(postId);
    return { success: true };
  }

  @Get('x/credentials')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get all active X credentials' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of active credentials' })
  async getXCredentials() {
    return this.xService.getActiveCredentials('x');
  }

  @Get('platforms')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'The platforms this deployment can post to, their limits and media needs' })
  @ApiBearerAuth()
  platforms() {
    return this.social.platforms();
  }

  @Get('accounts')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Active accounts, optionally for one platform' })
  @ApiBearerAuth()
  async getAccounts(@Query('platform') platform?: string) {
    return this.xService.getActiveCredentials(platform);
  }

  @Post('accounts')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Store or update an account for any platform' })
  @ApiBearerAuth()
  async storeAccount(@Body() dto: StoreSocialCredentialsDto) {
    return this.xService.storeCredentials(
      dto.accountName,
      {
        apiKey: dto.apiKey,
        apiSecret: dto.apiSecret,
        accessToken: dto.accessToken,
        accessTokenSecret: dto.accessTokenSecret,
        refreshToken: dto.refreshToken,
        bearerToken: dto.bearerToken,
        externalId: dto.externalId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      dto.platform,
    );
  }

  @Put('accounts/:credentialId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Edit an account; only the fields provided are changed' })
  @ApiBearerAuth()
  async updateAccount(@Param('credentialId') credentialId: string, @Body() dto: UpdateSocialCredentialsDto) {
    return this.xService.updateCredential(credentialId, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Delete('accounts/:credentialId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an account and its post history' })
  @ApiBearerAuth()
  async deleteAccount(@Param('credentialId') credentialId: string) {
    await this.xService.deleteCredential(credentialId);
    return { success: true, message: 'Account deleted' };
  }

  @Post('accounts/:credentialId/test')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Test an account on its own platform' })
  @ApiBearerAuth()
  async testAccount(@Param('credentialId') credentialId: string) {
    return this.social.testCredentials(credentialId);
  }

  @Post('post')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Post tailored copy to one platform with optional images' })
  @ApiBearerAuth()
  async postToPlatform(@Body() dto: PostToPlatformDto) {
    return this.social.postNow(dto.platform, dto.credentialId, dto.content, dto.mediaUrls ?? [], {
      reportId: dto.reportId,
    });
  }

  @Get('posts')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Post history across platforms' })
  @ApiBearerAuth()
  async getPlatformPosts(@Query('platform') platform?: string) {
    return this.xService.getPostHistory(undefined, 50, platform);
  }

  @Delete('posts/:postId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove one entry from the post history (the post itself is not deleted)' })
  @ApiBearerAuth()
  async deletePlatformPost(@Param('postId') postId: string) {
    await this.social.deletePost(postId);
    return { success: true };
  }

  @Post('posts/:postId/resend')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a draft or send a post again on its platform' })
  @ApiBearerAuth()
  async resendPlatformPost(@Param('postId') postId: string) {
    return this.social.resendPost(postId);
  }

  @Delete('failed-posts')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove failed attempts, optionally for one platform' })
  @ApiBearerAuth()
  async clearPlatformFailedPosts(@Query('platform') platform?: string) {
    return this.xService.clearFailedPosts(platform);
  }

  @Get('x/posts')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get X posts history' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of published posts' })
  async getPostHistory() {
    return this.xService.getPostHistory(undefined, 50, 'x');
  }

  @Get('x/posts/:credentialId')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get X posts history for specific credential' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of published posts for credential' })
  async getCredentialPostHistory(@Param('credentialId') credentialId: string) {
    return this.xService.getPostHistory(credentialId, 50, 'x');
  }

  @Get('x/automation')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Hourly posting config, today\'s slots, and read spend' })
  async getAutomation() {
    const view = await this.automation.view();
    return { ...view, streamConnected: this.stream.isConnected() };
  }

  @Put('x/automation')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Save the hourly posting and stream config' })
  async saveAutomation(@Body() dto: AutomationConfigDto) {
    const config = await this.automation.saveConfig(dto);
    const view = await this.automation.view();
    return { ...view, config, streamConnected: this.stream.isConnected() };
  }

  @Get('x/automation/preview')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Render today\'s slots against current prices without posting' })
  previewAutomation() {
    return this.automation.preview();
  }

  @Post('x/automation/run')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Run the slot that is due this minute, in the saved mode' })
  runAutomation() {
    return this.automation.runOnce(new Date());
  }

  @Get('report/:reportDate')
  @ApiOperation({ summary: 'Get market report preview for X posting' })
  @ApiResponse({ status: 200, description: 'Report data with card images' })
  async getReportPreview(@Param('reportDate') reportDate: string) {
    return this.marketReportService.getReportForXPosting(reportDate);
  }
}


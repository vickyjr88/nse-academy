import { Controller, Post, Get, Param, Body, UseGuards, HttpCode, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { XService } from './x.service';
import { MarketReportService } from './market-report.service';

// Keys copied from the X console often carry a trailing space or newline, which makes X answer 401.
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

// The global ValidationPipe uses whitelist: true, which strips every property that has no validator decorator.
class StoreXCredentialsDto {
  @trim() @IsString() @IsNotEmpty() accountName: string;
  @trim() @IsString() @IsNotEmpty() apiKey: string;
  @trim() @IsString() @IsNotEmpty() apiSecret: string;
  @trim() @IsString() @IsNotEmpty() accessToken: string;
  @trim() @IsString() @IsNotEmpty() accessTokenSecret: string;
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
    
    // Create post content
    const posts = this.marketReportService.createXPosts({
      title: '',
      date: dto.reportDate,
      summary: '',
      keyStats: { stocksUp: 0, stocksDown: 0, valueTraded: '', stocksTraded: 0 },
      topMovers: { gainers: [], losers: [] },
      cardImageUrls: report.cardImageUrls,
    });

    const result = await this.xService.postReportToX(
      dto.credentialId,
      posts[0],
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

  @Delete('x/credentials/:credentialId')
  @UseGuards(AdminAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Disable X API credentials' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Credentials disabled successfully' })
  async deleteXCredentials(@Param('credentialId') credentialId: string) {
    await this.xService.disableCredential(credentialId);
    return { success: true, message: 'Credential disabled' };
  }

  @Get('x/credentials')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get all active X credentials' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of active credentials' })
  async getXCredentials() {
    return this.xService.getActiveCredentials();
  }

  @Get('x/posts')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get X posts history' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of published posts' })
  async getPostHistory() {
    return this.xService.getPostHistory();
  }

  @Get('x/posts/:credentialId')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Get X posts history for specific credential' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of published posts for credential' })
  async getCredentialPostHistory(@Param('credentialId') credentialId: string) {
    return this.xService.getPostHistory(credentialId);
  }

  @Get('report/:reportDate')
  @ApiOperation({ summary: 'Get market report preview for X posting' })
  @ApiResponse({ status: 200, description: 'Report data with card images' })
  async getReportPreview(@Param('reportDate') reportDate: string) {
    return this.marketReportService.getReportForXPosting(reportDate);
  }
}


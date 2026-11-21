import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { XService } from './x.service';

@Injectable()
export class SocialMediaCronService {
  private readonly logger = new Logger(SocialMediaCronService.name);

  constructor(
    private prisma: PrismaService,
    private xService: XService,
  ) {}

  /**
   * Post daily report to X every day at 8:30 AM Nairobi time (5:30 AM UTC)
   * This runs after the daily report is generated
   * 
   * Note: This is a template implementation. To enable automatic posting,
   * you need to:
   * 1. Connect this to your daily report generation
   * 2. Pass the report content to postToX method
   * 3. Configure your X credentials first via the API
   */
  @Cron('30 5 * * *', {
    timeZone: 'UTC',
  })
  async postDailyReportToX(): Promise<void> {
    try {
      this.logger.debug('Daily report X posting job triggered');

      // Get active X credentials
      const credentials = await this.xService.getActiveCredentials();
      if (credentials.length === 0) {
        this.logger.warn('No active X credentials found - skipping X posting');
        return;
      }

      // TODO: Integrate with your actual daily report generation
      // The daily report is generated in DailyReportService.handleDailyReport()
      // You should:
      // 1. Trigger report generation
      // 2. Extract the summary and media
      // 3. Format for X (280 char limit)
      // 4. Call this.xService.postToX()

      this.logger.log('Daily report X posting ready (waiting for report generation integration)');
    } catch (error) {
      this.logger.error(`Failed to post daily report to X: ${error.message}`, error.stack);
    }
  }

  /**
   * Post weekly report to X every Monday at 8:30 AM Nairobi time
   */
  @Cron('30 5 * * 1', {
    timeZone: 'UTC',
  })
  async postWeeklyReportToX(): Promise<void> {
    try {
      this.logger.debug('Weekly report X posting job triggered');

      const credentials = await this.xService.getActiveCredentials();
      if (credentials.length === 0) {
        this.logger.warn('No active X credentials found - skipping X posting');
        return;
      }

      // TODO: Similar integration for weekly reports
      this.logger.log('Weekly report X posting ready (waiting for report generation integration)');
    } catch (error) {
      this.logger.error(`Failed to post weekly report to X: ${error.message}`, error.stack);
    }
  }

  /**
   * Example method showing how to post to X
   * This would be called from your report generation service
   */
  async postReportToX(
    reportType: 'daily' | 'weekly',
    content: string,
    mediaUrls?: string[],
    reportId?: string,
  ): Promise<void> {
    try {
      const credentials = await this.xService.getActiveCredentials();
      if (credentials.length === 0) {
        this.logger.warn(`No active X credentials found for ${reportType} report posting`);
        return;
      }

      const credential = credentials[0];
      const result = await this.xService.postToX(credential.id, content, mediaUrls, reportId);

      this.logger.log(`Successfully posted ${reportType} report to X: ${result.url}`);
    } catch (error) {
      this.logger.error(`Failed to post ${reportType} report to X: ${error.message}`, error.stack);
    }
  }
}

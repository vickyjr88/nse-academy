import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { XService } from './x.service';
import { MarketReportService } from './market-report.service';

/**
 * Cron jobs for social media marketing automation
 * This service handles scheduled posting to social media platforms
 */
@Injectable()
export class SocialMediaMarketingCronService {
  private readonly logger = new Logger(SocialMediaMarketingCronService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() private xService?: XService,
    @Optional() private marketReportService?: MarketReportService,
  ) {}

  /**
   * Post daily market reports to X (Twitter) at 8:30 AM Nairobi time
   * This runs after the daily report has been published
   * Reports must have card images stored before this runs
   */
  @Cron('30 8 * * *', { timeZone: 'Africa/Nairobi' })
  async postDailyReportToX(): Promise<void> {
    if (!this.xService || !this.marketReportService) {
      this.logger.warn('XService or MarketReportService not available, skipping X posting cron');
      return;
    }

    try {
      // Calculate yesterday's date (reports are for previous trading day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const reportDate = yesterday.toISOString().split('T')[0];

      this.logger.log(`Starting X posting cron for report date: ${reportDate}`);

      // Get report that hasn't been posted to X yet
      const report = await this.prisma.marketReport.findUnique({
        where: { sessionDate: reportDate },
      });

      if (!report) {
        this.logger.warn(`No report found for ${reportDate}, skipping X posting`);
        return;
      }

      if (report.xPosted) {
        this.logger.log(`Report ${reportDate} already posted to X, skipping`);
        return;
      }

      if (!report.cardImageUrls || report.cardImageUrls.length === 0) {
        this.logger.warn(`No card images available for ${reportDate}, skipping X posting`);
        return;
      }

      // Get active X credentials
      const credentials = await this.xService.getActiveCredentials();
      if (credentials.length === 0) {
        this.logger.warn('No active X credentials found, skipping X posting');
        return;
      }

      // Post to all active accounts
      for (const credential of credentials) {
        try {
          // Create post content
          const posts = this.marketReportService.createXPosts({
            title: report.sessionDate,
            date: report.sessionDate,
            summary: '',
            keyStats: { stocksUp: 0, stocksDown: 0, valueTraded: '', stocksTraded: 0 },
            topMovers: { gainers: [], losers: [] },
            cardImageUrls: report.cardImageUrls,
          });

          const result = await this.xService.postReportToX(
            credential.id,
            posts[0],
            report.cardImageUrls,
            reportDate,
          );

          this.logger.log(`Successfully posted report ${reportDate} to X account ${credential.accountName}`);

          // Mark report as posted (from first successful post)
          if (!report.xPosted) {
            await this.marketReportService.markAsPostedToX(reportDate, result.postId);
          }
        } catch (error) {
          this.logger.error(
            `Failed to post report ${reportDate} to X account ${credential.accountName}: ${(error as Error).message}`,
          );
          await this.marketReportService.markXPostingFailed(
            reportDate,
            `Account ${credential.accountName}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Daily report X posting cron failed: ${(error as Error).message}`);
    }
  }

  /**
   * Retry failed X postings from the last 7 days (every 6 hours)
   */
  @Cron('0 */6 * * *', { timeZone: 'Africa/Nairobi' })
  async retryFailedXPostings(): Promise<void> {
    if (!this.xService) {
      return;
    }

    try {
      // Look for reports with failed X postings in the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const failedReports = await this.prisma.marketReport.findMany({
        where: {
          xPosted: false,
          xError: { not: null },
          lastXAttemptAt: { gte: sevenDaysAgo },
        },
        take: 5, // Limit retries to avoid overwhelming
      });

      for (const report of failedReports) {
        try {
          const credentials = await this.xService!.getActiveCredentials();
          if (credentials.length === 0) continue;

          const result = await this.xService!.postReportToX(
            credentials[0].id,
            `NSE Report ${report.sessionDate}`, // Fallback text if details not available
            report.cardImageUrls || [],
            report.sessionDate,
          );

          await this.marketReportService?.markAsPostedToX(report.sessionDate, result.postId);
          this.logger.log(`Successfully retried posting report ${report.sessionDate} to X`);
        } catch (error) {
          this.logger.debug(
            `Retry posting report ${report.sessionDate} still failing: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Retry failed X postings cron failed: ${(error as Error).message}`);
    }
  }
}

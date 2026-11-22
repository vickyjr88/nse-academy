import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { publicCardUrls, reportSiteUrl } from '../market-report/market-report.service';

interface MarketReportData {
  title: string;
  date: string;
  summary: string;
  keyStats: {
    stocksUp: number;
    stocksDown: number;
    valueTraded: string;
    stocksTraded: number;
  };
  topMovers: {
    gainers: Array<{ symbol: string; name: string; change: string; price: string }>;
    losers: Array<{ symbol: string; name: string; change: string; price: string }>;
  };
  cardImageUrls: string[];
}

@Injectable()
export class MarketReportService {
  private readonly logger = new Logger(MarketReportService.name);
  private readonly REPORT_BASE_URL = 'https://nseacademy.vitaldigitalmedia.net/market-report';

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  /**
   * Fetch and parse market report for a specific date from the website
   * Date format: YYYY-MM-DD (e.g., 2026-11-20)
   */
  async fetchReportByDate(date: string): Promise<MarketReportData> {
    const url = `${this.REPORT_BASE_URL}/${date}`;

    try {
      const response = await axios.get(url);
      const html = response.data;

      return this.parseReportHTML(html, date);
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch market report for ${date}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Store report metadata and card image URLs for X posting
   * This is called after the report is generated and published
   */
  async storeReportForXPosting(sessionDate: string, cardImageUrls: string[]): Promise<void> {
    try {
      await this.prisma.marketReport.update({
        where: { sessionDate },
        data: {
          cardImageUrls,
          xPosted: false,
          lastXAttemptAt: null,
        },
      });
      this.logger.log(`Stored X posting data for report ${sessionDate}`);
    } catch (error) {
      this.logger.error(`Failed to store X posting data for ${sessionDate}: ${(error as Error).message}`);
    }
  }

  /**
   * Parse HTML to extract market report data
   */
  private parseReportHTML(html: string, date: string): MarketReportData {
    // Extract title from H1
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : 'NSE Market Report';

    // Extract key statistics from the content
    // Looking for patterns like "33 stocks fell, 17 rose"
    const keyStatsMatch = html.match(
      /(\d+)\s+stocks\s+fell[^;]*;\s+(\d+)\s+rose[^;]*;\s+total\s+value\s+traded\s+of\s+([^,]+),/i,
    );

    const stocksDown = keyStatsMatch ? parseInt(keyStatsMatch[1], 10) : 0;
    const stocksUp = keyStatsMatch ? parseInt(keyStatsMatch[2], 10) : 0;
    const valueTraded = keyStatsMatch ? keyStatsMatch[3].trim() : 'N/A';

    // Extract number of stocks traded
    const stocksTradedMatch = html.match(/out of\s+(\d+)\s+that\s+traded/i);
    const stocksTraded = stocksTradedMatch ? parseInt(stocksTradedMatch[1], 10) : 0;

    // Extract summary text (usually the first paragraph after the h1)
    const summaryMatch = html.match(/<p[^>]*>([^<]+NSE closed[^<]*)<\/p>/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    // Extract top gainers and losers
    const topMovers = this.extractTopMovers(html);

    // Extract card image URLs (cards 1-5)
    const cardImageUrls = this.extractCardImageUrls(date);

    return {
      title,
      date,
      summary: summary.substring(0, 280), // Keep it tweet-friendly
      keyStats: {
        stocksUp,
        stocksDown,
        valueTraded,
        stocksTraded,
      },
      topMovers,
      cardImageUrls,
    };
  }

  /**
   * Extract top gainers and losers from HTML
   */
  private extractTopMovers(html: string): MarketReportData['topMovers'] {
    const gainers: Array<{ symbol: string; name: string; change: string; price: string }> = [];
    const losers: Array<{ symbol: string; name: string; change: string; price: string }> = [];

    // Look for top gainers section
    const gainersMatch = html.match(/### Top gainers([\s\S]*?)### Top losers/);
    if (gainersMatch) {
      const gainersText = gainersMatch[1];
      // Extract first 3 gainers
      const gainersRows = gainersText.match(/\*\s+\[([^\]]+)\]\([^)]+\)([\+\-][\d.]+%)/g);
      if (gainersRows) {
        gainersRows.slice(0, 3).forEach((row) => {
          const match = row.match(/\*\s+\[([^]]+)\]\s*\n([^·]*?)·([^·]*?)·/);
          if (match) {
            gainers.push({
              symbol: match[1].split(' ')[0],
              name: match[1],
              change: row.match(/([\+\-][\d.]+%)/)?.[1] || '',
              price: match[3]?.trim() || '',
            });
          }
        });
      }
    }

    // Look for top losers section
    const losersMatch = html.match(/### Top losers([\s\S]*?)(?:### Where the money traded|$)/);
    if (losersMatch) {
      const losersText = losersMatch[1];
      const losersRows = losersText.match(/\*\s+\[([^\]]+)\]\([^)]+\)([\+\-][\d.]+%)/g);
      if (losersRows) {
        losersRows.slice(0, 3).forEach((row) => {
          const match = row.match(/\*\s+\[([^]]+)\]\s*\n([^·]*?)·([^·]*?)·/);
          if (match) {
            losers.push({
              symbol: match[1].split(' ')[0],
              name: match[1],
              change: row.match(/([\+\-][\d.]+%)/)?.[1] || '',
              price: match[3]?.trim() || '',
            });
          }
        });
      }
    }

    return { gainers, losers };
  }

  /**
   * Build card image URLs for the report date
   */
  private extractCardImageUrls(date: string): string[] {
    const urls: string[] = [];
    for (let i = 1; i <= 5; i++) {
      urls.push(`${this.REPORT_BASE_URL}/${date}/card/${i}`);
    }
    return urls;
  }

  /**
   * Create formatted X posts from market report data
   * Returns array of posts to be sent in order
   */
  createXPosts(reportData: MarketReportData): string[] {
    const { keyStats, topMovers, date } = reportData;

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dateFormatted = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });

    const topGainer = topMovers.gainers[0];
    const topLoser = topMovers.losers[0];

    // Main post text
    let mainPost = `NSE ${dayOfWeek} ${dateFormatted}: ${keyStats.stocksDown} down, ${keyStats.stocksUp} up`;

    if (topGainer) {
      mainPost += `\n📈 Top gainer: ${topGainer.symbol} +${topGainer.change}`;
    }

    if (topLoser) {
      mainPost += `\n📉 Top loser: ${topLoser.symbol} ${topLoser.change}`;
    }

    mainPost += `\n\nTurnover: ${keyStats.valueTraded}`;
    mainPost += `\n\nWatch the story cards below 👇`;

    return [mainPost];
  }

  /**
   * Verify report exists for a given date
   */
  async verifyReportExists(date: string): Promise<boolean> {
    try {
      const url = `${this.REPORT_BASE_URL}/${date}`;
      const response = await axios.head(url);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get report ready for X posting (with card images)
   */
  async getReportForXPosting(sessionDate: string) {
    const report = await this.prisma.marketReport.findUnique({
      where: { sessionDate },
    });

    if (!report) {
      throw new BadRequestException(`Report not found for date ${sessionDate}`);
    }

    if (report.status !== 'published') {
      throw new BadRequestException(`Report ${sessionDate} is not published yet.`);
    }

    // Cards are drawn on request by the public site. The column is only a cache,
    // and older reports were saved before anything wrote it.
    if (report.cardImageUrls.length > 0) return report;

    const cardImageUrls = publicCardUrls(reportSiteUrl((key) => this.config.get<string>(key)), sessionDate);
    await this.prisma.marketReport.update({ where: { sessionDate }, data: { cardImageUrls } }).catch((err) => {
      this.logger.warn(`Could not store card URLs for ${sessionDate}: ${(err as Error).message}`);
    });
    return { ...report, cardImageUrls };
  }

  /**
   * Mark report as posted to X
   */
  async markAsPostedToX(sessionDate: string, xPostId: string): Promise<void> {
    await this.prisma.marketReport.update({
      where: { sessionDate },
      data: {
        xPosted: true,
        xPostId,
        lastXAttemptAt: new Date(),
      },
    });
  }

  /**
   * Mark report X posting as failed
   */
  async markXPostingFailed(sessionDate: string, error: string): Promise<void> {
    await this.prisma.marketReport.update({
      where: { sessionDate },
      data: {
        xError: error,
        lastXAttemptAt: new Date(),
      },
    });
  }
}


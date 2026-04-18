import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdvisorService {
  private readonly cmsUrl: string;
  private readonly cmsToken: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.cmsUrl = this.configService.get<string>('CMS_URL', 'http://localhost:1337');
    this.cmsToken = this.configService.get<string>('CMS_API_TOKEN')!;
  }

  async getRecommendations(userId: string) {
    const profile = await this.prisma.investorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return {
        investorType: null,
        stocks: [],
        message: 'Please complete the investor profiler quiz first.',
      };
    }

    const stocks = await this.fetchStocksFromStrapi();

    // Recommendation logic:
    // 1. High risk/Growth investor -> high risk stocks
    // 2. Conservative/Moderate -> low/medium risk stocks
    // 3. Dividend seeker -> filter by dividend_yield > benchmark (e.g. 5%)
    
    let recommended = stocks;

    if (profile.type === 'dividend') {
      recommended = stocks
        .filter((s) => (s.dividend_yield || 0) > 4)
        .sort((a, b) => (b.dividend_yield || 0) - (a.dividend_yield || 0));
    } else if (profile.type === 'growth' || profile.type === 'aggressive') {
      recommended = stocks.filter((s) => s.risk_level === 'high' || s.risk_level === 'medium');
    } else if (profile.type === 'conservative') {
      recommended = stocks.filter((s) => s.risk_level === 'low');
    } else if (profile.type === 'moderate') {
      recommended = stocks.filter((s) => s.risk_level === 'medium' || s.risk_level === 'low');
    }

    // Limit to top 15 matches
    return {
      investorType: profile.type,
      riskScore: profile.riskScore,
      stocks: recommended.slice(0, 15),
    };
  }

  private async fetchStocksFromStrapi() {
    try {
      const response = await fetch(`${this.cmsUrl}/api/stock-profiles?pagination[limit]=100`, {
        headers: {
          Authorization: `Bearer ${this.cmsToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stocks from CMS');
      }

      const json = await response.json();
      return json.data || [];
    } catch (error) {
      console.error('Advisor fetch error:', error);
      throw new InternalServerErrorException('Could not connect to CMS for recommendations');
    }
  }
}

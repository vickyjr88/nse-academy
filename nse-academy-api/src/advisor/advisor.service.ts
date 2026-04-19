import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export type InvestorType = 'conservative' | 'moderate' | 'aggressive' | 'dividend' | 'growth';
export type RiskLevel = 'low' | 'medium' | 'high';
export type FitRating = 'excellent' | 'good' | 'neutral' | 'caution';

export interface StockProfile {
  id: number;
  ticker: string;
  company_name: string;
  sector: string;
  description: string;
  dividend_yield: number;
  risk_level: RiskLevel;
  investor_types: InvestorType[];
}

export interface TypeAnalysis {
  type: InvestorType;
  label: string;
  rating: FitRating;
  reasons: string[];
}

// Rules that determine suitability per investor type
function analyseForType(type: InvestorType, stock: StockProfile): { rating: FitRating; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const dy = stock.dividend_yield || 0;
  const risk = stock.risk_level;
  const inRecommended = (stock.investor_types || []).includes(type);

  if (inRecommended) score += 30;

  switch (type) {
    case 'conservative': {
      if (risk === 'low') { score += 30; reasons.push('Low risk — suitable for capital preservation'); }
      else if (risk === 'medium') { score += 10; reasons.push('Medium risk — slightly above conservative comfort zone'); }
      else { score -= 20; reasons.push('High risk — not ideal for capital preservation goals'); }

      if (dy >= 5) { score += 20; reasons.push(`Strong dividend yield (~${dy}%) provides reliable income`); }
      else if (dy >= 3) { score += 10; reasons.push(`Moderate dividend (~${dy}%) adds steady income`); }
      else if (dy === 0) { reasons.push('No dividend — less suitable for income-focused conservative investors'); }

      if (['Banking', 'Telecommunications', 'Manufacturing'].includes(stock.sector)) {
        score += 10; reasons.push(`${stock.sector} sector is typically stable and well-regulated`);
      }
      break;
    }

    case 'moderate': {
      if (risk === 'medium') { score += 30; reasons.push('Medium risk matches the balanced moderate profile'); }
      else if (risk === 'low') { score += 20; reasons.push('Low risk — safe anchor for a balanced portfolio'); }
      else { score += 5; reasons.push('High risk — use as a small growth allocation only'); }

      if (dy >= 3) { score += 15; reasons.push(`Dividend (~${dy}%) provides income while you wait for growth`); }

      reasons.push('Moderate investors benefit from a mix of stable and growth holdings');
      break;
    }

    case 'aggressive': {
      if (risk === 'high') { score += 35; reasons.push('High risk matches aggressive growth appetite'); }
      else if (risk === 'medium') { score += 20; reasons.push('Medium risk — decent upside with manageable volatility'); }
      else { score += 5; reasons.push('Low risk — too conservative for an aggressive portfolio core'); }

      if (dy < 3) { score += 5; reasons.push('Low dividend payout suggests earnings are reinvested for growth'); }
      reasons.push('Aggressive investors seek maximum capital appreciation over income');
      break;
    }

    case 'dividend': {
      if (dy >= 7) { score += 40; reasons.push(`Excellent yield (~${dy}%) — top-tier income stock`); }
      else if (dy >= 5) { score += 30; reasons.push(`Strong yield (~${dy}%) — well above average for NSE`); }
      else if (dy >= 3) { score += 15; reasons.push(`Moderate yield (~${dy}%) — acceptable for diversified income portfolio`); }
      else if (dy > 0) { score += 5; reasons.push(`Low yield (~${dy}%) — marginal income contribution`); }
      else { score -= 15; reasons.push('No dividend — not suitable as a core dividend holding'); }

      if (risk === 'low') { score += 10; reasons.push('Low risk supports sustainable long-term income'); }
      if (risk === 'high') { score -= 10; reasons.push('High risk may threaten dividend sustainability during downturns'); }
      break;
    }

    case 'growth': {
      if (risk === 'high') { score += 30; reasons.push('High risk signals high growth potential'); }
      else if (risk === 'medium') { score += 20; reasons.push('Medium risk — steady grower with upside'); }

      if (['Telecommunications', 'Banking', 'Energy & Petroleum'].includes(stock.sector)) {
        score += 15; reasons.push(`${stock.sector} is a high-growth sector on the NSE`);
      }

      if (dy < 3) { score += 10; reasons.push('Retained earnings over dividends signals reinvestment for growth'); }
      reasons.push('Growth investors prioritise capital appreciation over current income');
      break;
    }
  }

  let rating: FitRating;
  if (score >= 65) rating = 'excellent';
  else if (score >= 40) rating = 'good';
  else if (score >= 20) rating = 'neutral';
  else rating = 'caution';

  return { rating, reasons };
}

const TYPE_LABELS: Record<InvestorType, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
  dividend: 'Dividend Seeker',
  growth: 'Growth Investor',
};

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
    const profile = await this.prisma.investorProfile.findUnique({ where: { userId } });

    if (!profile) {
      return {
        investorType: null,
        stocks: [],
        message: 'Please complete the investor profiler quiz first.',
      };
    }

    const stocks = await this.fetchStocksFromStrapi();
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

    return {
      investorType: profile.type,
      riskScore: profile.riskScore,
      stocks: recommended.slice(0, 15),
    };
  }

  async researchCompany(userId: string, ticker: string) {
    const [profile, stocks] = await Promise.all([
      this.prisma.investorProfile.findUnique({ where: { userId } }),
      this.fetchStocksFromStrapi(),
    ]);

    const stock: StockProfile | undefined = stocks.find(
      (s: StockProfile) => s.ticker?.toUpperCase() === ticker.toUpperCase(),
    );

    if (!stock) {
      throw new NotFoundException(`No stock profile found for ticker "${ticker}". Ensure it has been seeded into the CMS.`);
    }

    const allTypes: InvestorType[] = ['conservative', 'moderate', 'aggressive', 'dividend', 'growth'];

    const investorTypeAnalysis: TypeAnalysis[] = allTypes.map((type) => {
      const { rating, reasons } = analyseForType(type, stock);
      return { type, label: TYPE_LABELS[type], rating, reasons };
    });

    // Sort: excellent → good → neutral → caution
    const ratingOrder: FitRating[] = ['excellent', 'good', 'neutral', 'caution'];
    investorTypeAnalysis.sort(
      (a, b) => ratingOrder.indexOf(a.rating) - ratingOrder.indexOf(b.rating),
    );

    // User-specific fit
    let userFit: { score: number; verdict: string; reason: string } | null = null;
    if (profile) {
      const { rating, reasons } = analyseForType(profile.type as InvestorType, stock);
      const verdictMap: Record<FitRating, { verdict: string; score: number }> = {
        excellent: { verdict: 'Strong Match', score: 90 },
        good: { verdict: 'Good Match', score: 70 },
        neutral: { verdict: 'Neutral Fit', score: 50 },
        caution: { verdict: 'Poor Fit', score: 25 },
      };
      const v = verdictMap[rating];
      userFit = {
        score: v.score,
        verdict: v.verdict,
        reason: `As a ${TYPE_LABELS[profile.type as InvestorType]} investor: ${reasons.slice(0, 2).join('. ')}.`,
      };
    }

    // List of all tickers for the search dropdown
    const allTickers = stocks.map((s: StockProfile) => ({
      ticker: s.ticker,
      company_name: s.company_name,
    }));

    return {
      company: {
        id: stock.id,
        ticker: stock.ticker,
        company_name: stock.company_name,
        sector: stock.sector,
        description: stock.description,
        dividend_yield: stock.dividend_yield,
        risk_level: stock.risk_level,
      },
      userProfile: profile
        ? { type: profile.type, label: TYPE_LABELS[profile.type as InvestorType], riskScore: profile.riskScore }
        : null,
      userFit,
      investorTypeAnalysis,
      allTickers,
    };
  }

  async getAllTickers() {
    const stocks = await this.fetchStocksFromStrapi();
    return stocks.map((s: StockProfile) => ({
      ticker: s.ticker,
      company_name: s.company_name,
      sector: s.sector,
    }));
  }

  private async fetchStocksFromStrapi() {
    try {
      const response = await fetch(`${this.cmsUrl}/api/stock-profiles?pagination[limit]=100`, {
        headers: { Authorization: `Bearer ${this.cmsToken}` },
      });

      if (!response.ok) throw new Error('Failed to fetch stocks from CMS');

      const json = await response.json();
      return json.data || [];
    } catch (error) {
      console.error('Advisor fetch error:', error);
      throw new InternalServerErrorException('Could not connect to CMS for recommendations');
    }
  }
}

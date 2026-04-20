import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      if (risk === 'low') { score += 30; reasons.push('Low risk profile — ideal for your capital preservation goals'); }
      else if (risk === 'medium') { score += 10; reasons.push('Medium risk — slightly above your preferred conservative threshold'); }
      else { score -= 20; reasons.push('High risk — volatile price action may conflict with your safety-first approach'); }

      if (dy >= 5) { score += 20; reasons.push(`Strong dividend yield (~${dy}%) provides reliable income`); }
      else if (dy >= 3) { score += 10; reasons.push(`Moderate dividend (~${dy}%) adds steady income`); }
      else if (dy === 0) { reasons.push('No dividend — less suitable for income-focused conservative investors'); }

      if (['Banking', 'Telecommunications', 'Manufacturing'].includes(stock.sector)) {
        score += 10; reasons.push(`${stock.sector} sector is typically stable and well-regulated`);
      }
      break;
    }

    case 'moderate': {
      if (risk === 'medium') { score += 30; reasons.push('Balanced risk-reward ratio aligns with your moderate appetite'); }
      else if (risk === 'low') { score += 20; reasons.push('Low risk — provides a stable foundation for your diversified portfolio'); }
      else { score += 5; reasons.push('High risk — restrict this to a small portion of your growth allocation'); }

      if (dy >= 3) { score += 15; reasons.push(`Dividend (~${dy}%) provides income while you wait for growth`); }

      reasons.push('Moderate investors benefit from a mix of stable and growth holdings');
      break;
    }

    case 'aggressive': {
      if (risk === 'high') { score += 35; reasons.push('High volatility potential matches your aggressive risk appetite'); }
      else if (risk === 'medium') { score += 20; reasons.push('Medium risk — offers strong upside with manageable day-to-day fluctuation'); }
      else { score += 5; reasons.push('Low risk — likely too slow-moving for your aggressive return targets'); }

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

  async getAiAdvice(userId: string, ticker: string) {
    const [profile, stocks] = await Promise.all([
      this.prisma.investorProfile.findUnique({ where: { userId } }),
      this.fetchStocksFromStrapi(),
    ]);

    const stock: StockProfile | undefined = stocks.find(
      (s: StockProfile) => s.ticker?.toUpperCase() === ticker.toUpperCase(),
    );
    if (!stock) throw new NotFoundException(`Ticker "${ticker}" not found`);

    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!geminiKey) throw new InternalServerErrorException('AI service not configured');

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      tools: [{ googleSearch: {} } as any],
    });

    const profileContext = profile
      ? `The investor is a ${TYPE_LABELS[profile.type as InvestorType]} investor. Risk score: ${profile.riskScore}/100. Investment horizon: ${profile.horizonYears} years. Capital range: ${profile.capitalRange}.`
      : 'The investor has not completed a profile yet — provide general analysis.';

    const prompt = `You are a senior NSE (Nairobi Securities Exchange) investment analyst providing real-time personalised advice to a Kenyan retail investor.

COMPANY: ${stock.company_name} (${stock.ticker}) — ${stock.sector} sector
INVESTOR PROFILE: ${profileContext}

Use Google Search to find the latest available information about ${stock.company_name} (${stock.ticker}) on the NSE, including:
1. Current market sentiment and latest news from 2024-2025.
2. Recent earnings reports or half-year results.
3. Market price action over the last few months.
4. Corporate actions (dividends declared, bonuses, etc.).
5. Potential threats or opportunities in their specific industry in Kenya.

Based on this real-time data and the investor's profile, provide a JSON response with exactly this structure:
{
  "situation": "2-3 sentence summary of what is happening with this company in the Kenyan market right now",
  "keyMetrics": ["Latest Price: KSh XX.XX", "52-Week Range: ...", "P/E Ratio: ...", "any other relevant metrics found"],
  "recommendation": "BUY" or "HOLD" or "AVOID",
  "recommendationRationale": "A direct, personalized sentence explaining why this fits (or doesn't fit) a ${profile ? TYPE_LABELS[profile.type as InvestorType] : 'retail'} investor with a ${profile ? profile.riskScore : 'standard'}/100 risk score.",
  "reasons": ["Specific reason based on latest news", "Specific reason based on fundamentals", "Specific reason based on technicals"],
  "risks": ["Immediate risk 1", "Immediate risk 2", "Immediate risk 3"],
  "outlook": "A forward-looking paragraph on the 6-12 month expectation for this stock.",
  "sources": ["List the specific news outlets or reports you found information from"]
}

Return ONLY the JSON object. Do not include markdown code blocks.`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      return {
        ticker: stock.ticker,
        company_name: stock.company_name,
        ...(parsed ?? {
          situation: text.slice(0, 400),
          keyMetrics: [],
          recommendation: 'HOLD',
          recommendationRationale: 'Insufficient data for a personalised recommendation.',
          reasons: ['Limited current data available'],
          risks: ['Market conditions may change rapidly'],
          outlook: 'Consult a licensed CMA-registered investment advisor for specific advice.',
          sources: [],
        }),
        disclaimer: 'AI-generated analysis for educational purposes only. Not financial advice. Verify with a CMA-registered broker.',
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Gemini AI advice error:', err);
      throw new InternalServerErrorException('AI analysis temporarily unavailable. Please try again.');
    }
  }

  private async fetchStocksFromStrapi() {
    try {
      const response = await fetch(`${this.cmsUrl}/api/stock-profiles?pagination[limit]=200`, {
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

import { Injectable, InternalServerErrorException, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AiUsage, ChatMessage, OpenRouterService } from '../openrouter/openrouter.service';
import { AiUsageService } from '../monitoring/ai-usage.service';
import { TavilyResult, TavilyService } from '../tavily/tavily.service';
import { loadDailyCloses } from '../market-data/price-history';
import { closeUnbalanced } from '../market-report/narrative';
import {
  AdviceBody,
  PositionFacts,
  PriceFacts,
  allNumbers,
  buildAdvicePrompt,
  buildPriceFacts,
  dataProblem,
  fallbackAdvice,
  figuresFromFacts,
  metricsFromFacts,
  relevantNews,
  verifyAdvice,
} from './advice-grounding';

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
      if (risk === 'low') { score += 30; reasons.push('Low risk profile - ideal for your capital preservation goals'); }
      else if (risk === 'medium') { score += 10; reasons.push('Medium risk - slightly above your preferred conservative threshold'); }
      else { score -= 20; reasons.push('High risk - volatile price action may conflict with your safety-first approach'); }

      if (dy >= 5) { score += 20; reasons.push(`Strong dividend yield (~${dy}%) provides reliable income`); }
      else if (dy >= 3) { score += 10; reasons.push(`Moderate dividend (~${dy}%) adds steady income`); }
      else if (dy === 0) { reasons.push('No dividend - less suitable for income-focused conservative investors'); }

      if (['Banking', 'Telecommunications', 'Manufacturing'].includes(stock.sector)) {
        score += 10; reasons.push(`${stock.sector} sector is typically stable and well-regulated`);
      }
      break;
    }

    case 'moderate': {
      if (risk === 'medium') { score += 30; reasons.push('Balanced risk-reward ratio aligns with your moderate appetite'); }
      else if (risk === 'low') { score += 20; reasons.push('Low risk - provides a stable foundation for your diversified portfolio'); }
      else { score += 5; reasons.push('High risk - restrict this to a small portion of your growth allocation'); }

      if (dy >= 3) { score += 15; reasons.push(`Dividend (~${dy}%) provides income while you wait for growth`); }

      reasons.push('Moderate investors benefit from a mix of stable and growth holdings');
      break;
    }

    case 'aggressive': {
      if (risk === 'high') { score += 35; reasons.push('High volatility potential matches your aggressive risk appetite'); }
      else if (risk === 'medium') { score += 20; reasons.push('Medium risk - offers strong upside with manageable day-to-day fluctuation'); }
      else { score += 5; reasons.push('Low risk - likely too slow-moving for your aggressive return targets'); }

      if (dy < 3) { score += 5; reasons.push('Low dividend payout suggests earnings are reinvested for growth'); }
      reasons.push('Aggressive investors seek maximum capital appreciation over income');
      break;
    }

    case 'dividend': {
      if (dy >= 7) { score += 40; reasons.push(`Excellent yield (~${dy}%) - top-tier income stock`); }
      else if (dy >= 5) { score += 30; reasons.push(`Strong yield (~${dy}%) - well above average for NSE`); }
      else if (dy >= 3) { score += 15; reasons.push(`Moderate yield (~${dy}%) - acceptable for diversified income portfolio`); }
      else if (dy > 0) { score += 5; reasons.push(`Low yield (~${dy}%) - marginal income contribution`); }
      else { score -= 15; reasons.push('No dividend - not suitable as a core dividend holding'); }

      if (risk === 'low') { score += 10; reasons.push('Low risk supports sustainable long-term income'); }
      if (risk === 'high') { score -= 10; reasons.push('High risk may threaten dividend sustainability during downturns'); }
      break;
    }

    case 'growth': {
      if (risk === 'high') { score += 30; reasons.push('High risk signals high growth potential'); }
      else if (risk === 'medium') { score += 20; reasons.push('Medium risk - steady grower with upside'); }

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

const FIT_VERDICTS: Record<FitRating, string> = { excellent: 'Strong Match', good: 'Good Match', neutral: 'Neutral Fit', caution: 'Poor Fit' };

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const NEWS_TTL_MS = 12 * 60 * 60 * 1000;
const NEWS_EMPTY_TTL_MS = 15 * 60 * 1000;
const ADVICE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const MAX_AI_ATTEMPTS = 2;

export interface AdviceResponse extends AdviceBody {
  ticker: string;
  company_name: string;
  /** Computed from our recorded prices (and the user's holding) - never written by the model. */
  keyMetrics: string[];
  dataAsOf: string | null;
  disclaimer: string;
  generatedAt: string;
  /** True only when a model wrote the narrative AND it passed verification. */
  aiGenerated: boolean;
  model?: string;
  note?: string | null;
  sources: string[];
  cached?: boolean;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** The model's JSON -> a checked AdviceBody, or what is wrong with it. */
export function parseAdvice(raw: string): { advice: AdviceBody | null; errors: string[] } {
  const start = raw.indexOf('{');
  if (start < 0) return { advice: null, errors: ['no JSON object found in the output'] };
  const end = raw.lastIndexOf('}');
  // No closing brace at all is the "one brace short" case; otherwise cut off any text after the object.
  const candidate = end > start ? raw.slice(start, end + 1) : raw.slice(start).replace(/`+\s*$/, '');
  let j: any;
  try {
    j = JSON.parse(candidate);
  } catch (e) {
    const repaired = closeUnbalanced(candidate);
    try {
      if (!repaired) throw e;
      j = JSON.parse(repaired);
    } catch {
      return { advice: null, errors: [`the JSON did not parse: ${(e as Error).message}`] };
    }
  }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const rec = str(j?.recommendation).toUpperCase();
  const advice: AdviceBody = {
    situation: str(j?.situation),
    recommendation: (['BUY', 'HOLD', 'AVOID'].includes(rec) ? rec : 'HOLD') as AdviceBody['recommendation'],
    recommendationRationale: str(j?.recommendationRationale),
    reasons: arr(j?.reasons),
    risks: arr(j?.risks),
    outlook: str(j?.outlook),
  };
  const errors: string[] = [];
  if (!['BUY', 'HOLD', 'AVOID'].includes(rec)) errors.push('recommendation must be BUY, HOLD or AVOID');
  if (!advice.situation) errors.push('situation is missing');
  if (!advice.recommendationRationale) errors.push('recommendationRationale is missing');
  if (advice.reasons.length === 0) errors.push('at least one reason is required');
  if (advice.risks.length === 0) errors.push('at least one risk is required');
  if (!advice.outlook) errors.push('outlook is missing');
  return { advice: errors.length ? null : advice, errors };
}

@Injectable()
export class StockAdvisorService {
  private readonly logger = new Logger(StockAdvisorService.name);
  private readonly cmsUrl: string;
  private readonly cmsToken: string;
  private readonly newsCache = new Map<string, { at: number; value: TavilyResult[] }>();
  private readonly adviceCache = new Map<string, { at: number; value: AdviceResponse }>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private openRouter: OpenRouterService,
    private tavily: TavilyService,
    @Optional() private aiUsage?: AiUsageService,
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

  /**
   * AI commentary on one stock, grounded in our own data. The price, its moves, the 60-session range and the
   * user's position are computed here from recorded closes and shown as the key metrics; the model only writes
   * the narrative, and anything it writes that carries a KSh/% figure must come from our data or the search
   * results (advice-grounding.verifyAdvice). If the data is missing or stale, or the model cannot produce
   * something that checks out in MAX_AI_ATTEMPTS, the user gets a plain HOLD with the reason - never a
   * confident BUY/AVOID resting on nothing.
   */
  async getAiAdvice(userId: string, ticker: string): Promise<AdviceResponse> {
    const [profile, stocks] = await Promise.all([
      this.prisma.investorProfile.findUnique({ where: { userId } }),
      this.fetchStocksFromStrapi(),
    ]);

    const stock: StockProfile | undefined = stocks.find(
      (s: StockProfile) => s.ticker?.toUpperCase() === ticker.toUpperCase(),
    );
    if (!stock) throw new NotFoundException(`Ticker "${ticker}" not found`);

    if (!this.openRouter.hasCredentials()) {
      throw new InternalServerErrorException('AI service not configured');
    }

    const cacheKey = `${userId}:${stock.ticker.toUpperCase()}`;
    const hit = this.fresh(this.adviceCache, cacheKey, ADVICE_TTL_MS);
    if (hit) return { ...hit, cached: true };

    const today = new Date(Date.now() + EAT_OFFSET_MS).toISOString().slice(0, 10);
    const [closes, holdings] = await Promise.all([
      loadDailyCloses(this.prisma, [stock.ticker.toUpperCase()]),
      this.prisma.holding.findMany({ where: { userId, ticker: stock.ticker.toUpperCase(), quantity: { gt: 0 } } }),
    ]);
    const facts = buildPriceFacts(closes.get(stock.ticker.toUpperCase()), today);

    let position: PositionFacts | null = null;
    if (holdings.length > 0) {
      const quantity = holdings.reduce((n, h) => n + h.quantity, 0);
      const costed = holdings.every((h) => h.avgCost != null);
      const avgCost = costed ? holdings.reduce((n, h) => n + (h.avgCost as number) * h.quantity, 0) / quantity : null;
      position = {
        quantity,
        avgCost,
        costEstimated: holdings.some((h) => h.costSource === 'IMPORT_PRICE'),
        gainPct: facts && avgCost ? ((facts.priceKes - avgCost) / avgCost) * 100 : null,
      };
    }

    let userFit: { verdict: string; reasons: string[] } | null = null;
    if (profile) {
      const { rating, reasons } = analyseForType(profile.type as InvestorType, stock);
      userFit = { verdict: FIT_VERDICTS[rating], reasons };
    }

    const base = { ticker: stock.ticker, company_name: stock.company_name };
    const finish = (advice: AdviceBody, extra: Pick<AdviceResponse, 'aiGenerated' | 'sources'> & Partial<AdviceResponse>): AdviceResponse => ({
      ...base,
      ...advice,
      keyMetrics: facts ? metricsFromFacts(facts, stock, position) : [],
      dataAsOf: facts?.asOf ?? null,
      disclaimer: 'AI-generated analysis for educational purposes only. Not financial advice. Verify with a CMA-registered broker.',
      generatedAt: new Date().toISOString(),
      ...extra,
    });

    const problem = dataProblem(facts);
    if (problem) {
      return finish(fallbackAdvice(stock, facts, userFit, problem), { aiGenerated: false, note: problem, sources: [] });
    }
    const f = facts as PriceFacts;

    const news = await this.newsFor(stock);
    const newsText = news.map((r, i) => `[${i + 1}] ${r.title} (${r.url})\n${r.content}`).join('\n\n');
    const allowed = new Set<string>([
      ...figuresFromFacts(f, position, [stock.dividend_yield]),
      ...allNumbers(news.map((r) => `${r.title} ${r.content}`).join(' ')),
    ]);

    const profileContext = profile
      ? `A ${TYPE_LABELS[profile.type as InvestorType]} investor. Risk score ${profile.riskScore}/100. Horizon ${profile.horizonYears} years. Capital range ${profile.capitalRange}.`
      : 'No investor profile yet - keep it general.';
    const positionContext = position
      ? `POSITION: already holds ${position.quantity.toLocaleString('en-KE')} shares${position.gainPct != null ? `, ${position.gainPct >= 0 ? 'up' : 'down'} ${Math.abs(position.gainPct).toFixed(1)}% on cost${position.costEstimated ? ' (cost is an estimate)' : ''}` : ''}.`
      : 'POSITION: does not hold it yet.';

    let messages: ChatMessage[] = [
      {
        role: 'user',
        content: buildAdvicePrompt({
          company: stock.company_name,
          ticker: stock.ticker,
          sector: stock.sector,
          profileContext,
          positionContext,
          metrics: metricsFromFacts(f, stock, position),
          news: newsText,
          hasNews: news.length > 0,
        }),
      },
    ];

    let lastProblems: string[] = [];
    const startedAtMs = Date.now();
    const spent = { prompt: 0, completion: 0, cost: 0, hasCost: false };
    const log = (attempts: number, model: string | null, ok: boolean, verified: boolean | null, detail: string) =>
      this.aiUsage?.record({
        feature: 'advisor',
        model,
        ok,
        verified,
        attempts,
        durationMs: Date.now() - startedAtMs,
        promptTokens: spent.prompt || null,
        completionTokens: spent.completion || null,
        costUsd: spent.hasCost ? spent.cost : null,
        userId,
        detail: `${stock.ticker}: ${detail}`,
      });
    for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
      let content: string;
      let model: string;
      let usage: AiUsage;
      try {
        ({ content, model, usage } = await this.openRouter.chatCompletionDetailed({ messages, temperature: 0.3, timeoutMs: 90_000, ...this.modelChain() }));
        spent.prompt += usage?.promptTokens ?? 0;
        spent.completion += usage?.completionTokens ?? 0;
        if (typeof usage?.costUsd === 'number') {
          spent.cost += usage.costUsd;
          spent.hasCost = true;
        }
      } catch (err) {
        this.logger.error(`AI advice request failed for ${stock.ticker} (attempt ${attempt}): ${(err as Error).message}`);
        await log(attempt, null, false, null, `request failed: ${(err as Error).message}`);
        throw new InternalServerErrorException('AI analysis temporarily unavailable. Please try again.');
      }

      const parsed = parseAdvice(content);
      const problems = parsed.advice ? verifyAdvice(parsed.advice, allowed, f) : parsed.errors;
      if (parsed.advice && problems.length === 0) {
        const advice = parsed.advice;
        const out = finish(advice, {
          aiGenerated: true,
          model,
          note: news.length === 0 ? 'No recent news was found, so this view rests on price data and the company profile only.' : null,
          sources: news.slice(0, 6).map((r) => `${r.title} (${hostOf(r.url)})`),
        });
        this.remember(this.adviceCache, cacheKey, out);
        await log(attempt, model, true, true, 'verified');
        return out;
      }
      lastProblems = problems;
      this.logger.warn(`AI advice for ${stock.ticker} rejected on attempt ${attempt}: ${problems.slice(0, 4).join('; ')}`);
      messages = [
        ...messages,
        { role: 'assistant', content },
        { role: 'user', content: `Your answer was rejected: ${problems.slice(0, 6).join('; ')}. Return the complete JSON object again. Do not state any KSh amount or percentage that is not in OUR DATA or the news above.` },
      ];
    }

    const why = 'The AI analysis could not be verified against our price data and the news it was given.';
    await log(MAX_AI_ATTEMPTS, null, true, false, `not verified: ${lastProblems[0] ?? 'unparseable output'}`);
    return finish(fallbackAdvice(stock, f, userFit, why), { aiGenerated: false, note: `${why} (${lastProblems[0] ?? 'unparseable output'})`, sources: [] });
  }

  /** STOCK_ADVICE_MODEL / STOCK_ADVICE_FALLBACK_MODELS give the advisor its own model chain; unset = inherit OPENROUTER_MODEL. */
  private modelChain(): { model?: string; fallbackModels?: string[] } {
    const model = this.configService.get<string>('STOCK_ADVICE_MODEL')?.trim();
    if (!model) return {};
    const fallbackModels = (this.configService.get<string>('STOCK_ADVICE_FALLBACK_MODELS') ?? '').split(',').map((m) => m.trim()).filter(Boolean);
    return { model, fallbackModels };
  }

  private fresh<T>(cache: Map<string, { at: number; value: T }>, key: string, ttl: number): T | null {
    const e = cache.get(key);
    return e && Date.now() - e.at < ttl ? e.value : null;
  }

  private remember<T>(cache: Map<string, { at: number; value: T }>, key: string, value: T) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.delete(key);
    cache.set(key, { at: Date.now(), value });
  }

  /** News for a company, shared by everyone who asks within NEWS_TTL_MS so the search quota is spent per company, not per click. */
  private async newsFor(stock: StockProfile): Promise<TavilyResult[]> {
    const key = stock.ticker.toUpperCase();
    const hit = this.fresh(this.newsCache, key, NEWS_TTL_MS);
    if (hit) return hit;
    // The ticker and "NSE" keep the search on this company's Kenyan coverage (without them Safaricom and Home Afrika
    // return nothing relevant). Searches still drift to the exchange's own pages, so results are filtered to those
    // that name the company before the model sees them.
    const found = await this.tavily.search({
      query: `${stock.company_name} ${stock.ticker} NSE Nairobi Securities Exchange latest news earnings dividend`,
      topic: 'finance',
      timeRange: 'month',
      maxResults: 8,
    });
    const results = relevantNews(found, stock).slice(0, 5);
    // An empty answer (no key, an error, nothing found) is remembered only briefly so it is retried soon.
    if (results.length > 0) this.remember(this.newsCache, key, results);
    else this.newsCache.set(key, { at: Date.now() - NEWS_TTL_MS + NEWS_EMPTY_TTL_MS, value: [] });
    return results;
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
      this.logger.error(`Advisor fetch error: ${(error as Error).message}`);
      throw new InternalServerErrorException('Could not connect to CMS for recommendations');
    }
  }
}

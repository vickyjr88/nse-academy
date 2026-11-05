// Grounding for the AI stock advice. Everything the user is shown as a *fact* (price, changes, range, their
// position) is computed here from our own price history; the model only writes the narrative around it, and what it
// writes is checked before it is shown. Pure functions: no database, clock or network.

import { DailyClose } from '../market-data/price-history';

export type Recommendation = 'BUY' | 'HOLD' | 'AVOID';

export interface PriceFacts {
  /** Nairobi date of the latest close, YYYY-MM-DD. */
  asOf: string;
  priceKes: number;
  dayChangePct: number | null;
  change5Pct: number | null;
  change20Pct: number | null;
  change60Pct: number | null;
  hi60: number;
  lo60: number;
  /** Sessions of history behind the figures. */
  sessions: number;
  /** Whole days between the latest close and today. */
  daysOld: number;
}

export interface PositionFacts {
  quantity: number;
  avgCost: number | null;
  costEstimated: boolean;
  gainPct: number | null;
}

/** Fewer sessions than this and a "trend" is just noise. */
export const MIN_SESSIONS = 20;
/** A close older than this is not "current": the counter may be suspended or the feed down. */
export const MAX_STALE_DAYS = 7;

const pct = (now: number, then: number | undefined): number | null => (then && then > 0 ? ((now - then) / then) * 100 : null);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

export function buildPriceFacts(closes: DailyClose[] | undefined, todayYmd: string): PriceFacts | null {
  if (!closes || closes.length === 0) return null;
  const c = closes.slice().sort((a, b) => a.date.localeCompare(b.date));
  const last = c[c.length - 1];
  const back = (n: number) => (c.length > n ? c[c.length - 1 - n].price : undefined);
  const window = c.slice(-60).map((x) => x.price);
  return {
    asOf: last.date,
    priceKes: last.price,
    dayChangePct: pct(last.price, back(1)),
    change5Pct: pct(last.price, back(5)),
    change20Pct: pct(last.price, back(20)),
    change60Pct: pct(last.price, back(59)),
    hi60: Math.max(...window),
    lo60: Math.min(...window),
    sessions: c.length,
    daysOld: Math.max(0, dayDiff(todayYmd, last.date)),
  };
}

/** Why the AI is not asked at all, or null when the data is good enough to ground it. */
export function dataProblem(f: PriceFacts | null): string | null {
  if (!f) return 'NSE Academy has no recorded prices for this stock, so there is nothing current to base a view on.';
  if (f.daysOld > MAX_STALE_DAYS) return `The latest recorded price for this stock is from ${f.asOf}, which is too old to base a view on.`;
  if (f.sessions < MIN_SESSIONS) return `Only ${f.sessions} trading days of price history are recorded for this stock, which is not enough for a trend.`;
  return null;
}

/** Where the latest close sits between the 60-session low (0) and high (1); null when the range is flat. */
export function rangePosition(f: PriceFacts): number | null {
  return f.hi60 > f.lo60 ? (f.priceKes - f.lo60) / (f.hi60 - f.lo60) : null;
}

const money = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(1)}%`;

/** The "key metrics" list. Built here, never by the model, so the numbers cannot be invented or stale. */
export function metricsFromFacts(
  f: PriceFacts,
  stock: { dividend_yield?: number | null; risk_level?: string; sector?: string },
  position: PositionFacts | null,
): string[] {
  const out = [`Latest close: ${money(f.priceKes)} (${f.asOf})`];
  if (f.dayChangePct != null) out.push(`Today: ${signed(f.dayChangePct)}`);
  if (f.change20Pct != null) out.push(`20 sessions: ${signed(f.change20Pct)}`);
  if (f.change60Pct != null) out.push(`60 sessions: ${signed(f.change60Pct)}`);
  out.push(`${Math.min(f.sessions, 60)}-session range: ${money(f.lo60)} - ${money(f.hi60)}`);
  const pos = rangePosition(f);
  if (pos != null) out.push(`Position in that range: ${Math.round(pos * 100)}% of the way from the low to the high`);
  if (stock.dividend_yield) out.push(`Dividend yield (profile): ${stock.dividend_yield}%`);
  if (stock.risk_level) out.push(`Risk rating: ${stock.risk_level}`);
  if (position) {
    out.push(`You hold: ${position.quantity.toLocaleString('en-KE')} shares`);
    if (position.avgCost != null && position.gainPct != null) {
      out.push(`On your cost (${money(position.avgCost)}${position.costEstimated ? ', estimated' : ''}): ${signed(position.gainPct)}`);
    }
  }
  return out;
}

// --- checking what the model wrote -----------------------------------------------------------------

/** "KSh 1,234.50" / "12.5%" -> "1234.5" / "12.5". Same number, same string, whatever the formatting. */
function canon(raw: string): string {
  const n = parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : raw;
}

const FIGURE = /(?:KSh|KES|Ksh|Sh)\.?\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:%|per\s?cent|percent)/gi;

/** Money and percentage figures in a text, canonicalised. Plain numbers ("7 countries", "2026") are not checked. */
export function extractFigures(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(FIGURE)) out.push(canon(m[1] ?? m[2]));
  return out;
}

/** Every number in a text (used to collect what the search results actually say). */
export function allNumbers(text: string): Set<string> {
  const set = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) set.add(canon(m[0]));
  return set;
}

/** Numbers our own data supports, at the precisions we display. */
export function figuresFromFacts(f: PriceFacts, position: PositionFacts | null, extra: (number | null | undefined)[] = []): Set<string> {
  const set = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return;
    for (const dp of [0, 1, 2]) {
      set.add(canon(n.toFixed(dp)));
      set.add(canon(Math.abs(n).toFixed(dp)));
    }
  };
  [f.priceKes, f.dayChangePct, f.change5Pct, f.change20Pct, f.change60Pct, f.hi60, f.lo60, ...extra].forEach(add);
  if (position) [position.avgCost, position.gainPct].forEach(add);
  return set;
}

export interface AdviceBody {
  situation: string;
  recommendation: Recommendation;
  recommendationRationale: string;
  reasons: string[];
  risks: string[];
  outlook: string;
}

/** Words claiming the price is at the top / bottom of its range, or that momentum points a particular way. */
const NEAR_TOP = /\b(?:near|close to|approaching|at)\s+(?:the\s+|its\s+)?(?:\d+[-\s]?(?:session|day)\s+)?(?:upper(?:\s+(?:end|bound|half|part|edge))?|top|high)\b/i;
const NEAR_BOTTOM = /\b(?:near|close to|approaching|at)\s+(?:the\s+|its\s+)?(?:\d+[-\s]?(?:session|day)\s+)?(?:lower(?:\s+(?:end|bound|half|part|edge))?|bottom|low)\b/i;
const UP_MOMENTUM = /\b(?:upward|positive|bullish|strong)\s+(?:momentum|trend)\b|\buptrend\b/i;
const DOWN_MOMENTUM = /\b(?:downward|negative|bearish|weak)\s+(?:momentum|trend)\b|\bdowntrend\b/i;

/** Claims about where the price sits in its range, or which way it has been moving, that our own numbers contradict. */
export function trendClaimProblems(text: string, f: PriceFacts): string[] {
  const out: string[] = [];
  const pos = rangePosition(f);
  if (pos != null) {
    if (NEAR_TOP.test(text) && pos < 0.7) out.push(`says the price is near the top of its range, but it is ${Math.round(pos * 100)}% of the way from the low to the high`);
    if (NEAR_BOTTOM.test(text) && pos > 0.3) out.push(`says the price is near the bottom of its range, but it is ${Math.round(pos * 100)}% of the way from the low to the high`);
  }
  const moves = [f.change5Pct, f.change20Pct, f.change60Pct].filter((x): x is number => x != null);
  if (moves.length && UP_MOMENTUM.test(text) && moves.every((m) => m <= 0)) out.push('claims upward momentum, but the price is down or flat over 5, 20 and 60 sessions');
  if (moves.length && DOWN_MOMENTUM.test(text) && moves.every((m) => m >= 0)) out.push('claims downward momentum, but the price is up or flat over 5, 20 and 60 sessions');
  return out;
}

const OVERCONFIDENT = /\b(guarantee[ds]?|risk[- ]free|cannot lose|can'?t lose|certain(?:ly)? to (?:rise|gain|go up|double))\b/i;

/** Returns what is wrong with the model's output (empty = fine). */
export function verifyAdvice(advice: AdviceBody, allowedFigures: Set<string>, facts?: PriceFacts): string[] {
  const problems: string[] = [];
  const fields: [string, string][] = [
    ['situation', advice.situation],
    ['recommendationRationale', advice.recommendationRationale],
    ['outlook', advice.outlook],
    ...advice.reasons.map((r, i): [string, string] => [`reasons[${i}]`, r]),
    ...advice.risks.map((r, i): [string, string] => [`risks[${i}]`, r]),
  ];
  for (const [name, text] of fields) {
    for (const fig of extractFigures(text)) {
      if (!allowedFigures.has(fig)) problems.push(`${name}: "${fig}" appears in neither our price data nor the search results`);
    }
    const m = OVERCONFIDENT.exec(text);
    if (m) problems.push(`${name}: "${m[0]}" overstates certainty - nothing about a share price is guaranteed`);
    if (facts) for (const p of trendClaimProblems(text, facts)) problems.push(`${name}: ${p}`);
  }
  return [...new Set(problems)];
}

const GENERIC_NAME_WORDS = new Set(['plc', 'ltd', 'limited', 'group', 'holdings', 'holding', 'company', 'co', 'corporation', 'corp', 'inc', 'ord', 'the', 'of', 'and', '&', 'kenya', 'east', 'africa']);
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Search engines return whatever matches the words - for KCB that was the Nairobi Securities Exchange's own
 * results page, which then got written up as if it were KCB's news. Keep only results whose title or text
 * actually names the company (its distinctive name, or its ticker as a whole word).
 */
export function relevantNews<T extends { title: string; content: string }>(results: T[], stock: { company_name: string; ticker: string }): T[] {
  const words = stock.company_name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z0-9&]+/)
    .filter((w) => w && !GENERIC_NAME_WORDS.has(w));
  const phrase = words.join('[\\s-]+');
  const patterns = [new RegExp(`\\b${escapeRe(stock.ticker)}\\b`, 'i')];
  if (phrase) patterns.push(new RegExp(`\\b${words.map(escapeRe).join('[\\s-]+')}\\b`, 'i'));
  return results.filter((r) => patterns.some((re) => re.test(`${r.title} ${r.content}`)));
}

/** What a user sees when there is no data, or the model could not produce something that checks out. Never BUY/AVOID. */
export function fallbackAdvice(
  stock: { company_name: string; sector?: string },
  facts: PriceFacts | null,
  fit: { verdict: string; reasons: string[] } | null,
  why: string,
): AdviceBody {
  const situation = facts
    ? `${stock.company_name} closed at ${money(facts.priceKes)} on ${facts.asOf}${facts.change20Pct != null ? `, ${signed(facts.change20Pct)} over the last 20 sessions` : ''}, within a ${Math.min(facts.sessions, 60)}-session range of ${money(facts.lo60)} to ${money(facts.hi60)}.`
    : `${stock.company_name}${stock.sector ? ` (${stock.sector})` : ''}: no recent price data is recorded.`;
  return {
    situation,
    recommendation: 'HOLD',
    recommendationRationale: `${why} NSE Academy is therefore not giving a buy or avoid view on this stock right now.`,
    reasons: fit?.reasons.length ? fit.reasons.slice(0, 3) : ['Use the company profile and your own risk profile to judge whether it suits you.'],
    risks: ['Share prices can fall as well as rise, and you can lose part or all of what you invest.'],
    outlook: 'Check the company\'s latest results, dividend announcements and NSE notices, or speak to a CMA-licensed adviser, before deciding.',
  };
}

export function buildAdvicePrompt(input: {
  company: string;
  ticker: string;
  sector: string;
  profileContext: string;
  positionContext: string;
  metrics: string[];
  news: string;
  hasNews: boolean;
}): string {
  return `You are a careful NSE (Nairobi Securities Exchange) analyst writing educational commentary for a Kenyan retail investor.

COMPANY: ${input.company} (${input.ticker}) - ${input.sector} sector
INVESTOR: ${input.profileContext}
${input.positionContext}

OUR DATA (authoritative - NSE Academy's own recorded closing prices; the investor sees these figures separately):
${input.metrics.map((m) => `- ${m}`).join('\n')}

${input.hasNews ? 'RECENT NEWS (search results; may be older than our data and can disagree with it):' : 'RECENT NEWS: none was found. Say plainly that this view rests on price data and the company profile only.'}
${input.news}

Write a JSON object with exactly these keys:
{
  "situation": "2-3 sentences on what is going on with this company, from the news if there is any, otherwise from the price trend in OUR DATA",
  "recommendation": "BUY" or "HOLD" or "AVOID",
  "recommendationRationale": "one direct sentence on why this does or does not suit THIS investor's type and risk score",
  "reasons": ["2-4 specific reasons"],
  "risks": ["2-3 specific risks"],
  "outlook": "a short paragraph on the 6-12 month picture, stated as uncertain"
}

RULES
- For the share price and how it has moved, use ONLY OUR DATA. If a news item quotes a different or older price, ignore that price.
- Any other KSh amount or percentage you write (earnings, dividends, growth) must be stated in the news above. Never invent or estimate a figure.
- Use a news item only if it is about THIS company. Ignore anything about the exchange itself, the wider market or other companies, even if it appears below.
- "Position in that range" in OUR DATA says whether the price is near the top (close to 100%), the middle or the bottom (close to 0%) of its range. Do not describe it as near the top or bottom unless that figure agrees.
- If the investor already holds the stock, speak to that position; never tell them to buy or sell a specific number of shares.
- No guarantees, no "certain to rise". Choose HOLD whenever the evidence is thin or mixed.
- Return ONLY the JSON object, no markdown.`;
}

// Research facts and the focus-list screens. Pure. Everything stated about a stock is computed from stored prices and
// trading values, with the thresholds written down here and shown to the reader. The screens ask "which liquid stocks
// are worth a closer look, and why"; they never say buy or sell, and a person adds the commentary before publishing.

import { DailyBar } from '../market-data/price-history';

export const MIN_SESSIONS = 60;
/** Stocks that trade less than this a day on average are left out: their prices move on a handful of trades. */
export const MIN_AVG_VALUE_KES = 2_000_000;
export const MAX_STALE_DAYS = 7;

export const REVIEWER_PLACEHOLDER = '[Reviewer commentary';

export interface StockFacts {
  ticker: string;
  name: string;
  sector: string | null;
  asOf: string;
  price: number;
  /** Percent change over the last 30 and 90 calendar days; null when history does not reach back that far. */
  ret1mPct: number | null;
  ret3mPct: number | null;
  high60: number;
  low60: number;
  /** Close versus the 60-session high, in percent: 0 at the high, negative below it. */
  fromHighPct: number;
  /** Close versus the 60-session low, in percent: 0 at the low, positive above it. */
  fromLowPct: number;
  /** Standard deviation of daily percentage changes over the last 60 sessions. */
  volatilityPct: number;
  /** Mean value traded per session over the last 20 sessions, KSh. */
  avgDailyValueKes: number;
  sessions: number;
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const ymdMinus = (ymd: string, days: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);

function returnOver(bars: DailyBar[], asOf: string, days: number): number | null {
  const target = ymdMinus(asOf, days);
  const base = [...bars].reverse().find((b) => b.date <= target);
  if (!base || base.price <= 0) return null;
  // The base close must be within a week of the target date, or the figure describes a different period than it claims.
  if (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${base.date}T00:00:00Z`) > 7 * 86_400_000) return null;
  const last = bars[bars.length - 1];
  return ((last.price - base.price) / base.price) * 100;
}

/** null when there is too little history, or the stock has not traded recently (so the facts would be stale). */
export function computeStockFacts(ticker: string, name: string, sector: string | null, rawBars: DailyBar[], todayYmd: string): StockFacts | null {
  const bars = rawBars.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (bars.length < MIN_SESSIONS) return null;
  const last = bars[bars.length - 1];
  if (Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`) > MAX_STALE_DAYS * 86_400_000) return null;

  const window = bars.slice(-MIN_SESSIONS);
  const high = Math.max(...window.map((b) => b.price));
  const low = Math.min(...window.map((b) => b.price));
  const rets = window.slice(1).map((b, i) => ((b.price - window[i].price) / window[i].price) * 100);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const vol = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length);
  const recent = bars.slice(-20);
  return {
    ticker,
    name,
    sector,
    asOf: last.date,
    price: last.price,
    ret1mPct: returnOver(bars, last.date, 30),
    ret3mPct: returnOver(bars, last.date, 90),
    high60: high,
    low60: low,
    fromHighPct: ((last.price - high) / high) * 100,
    fromLowPct: low > 0 ? ((last.price - low) / low) * 100 : 0,
    volatilityPct: vol,
    avgDailyValueKes: recent.reduce((s, b) => s + b.valueKes, 0) / recent.length,
    sessions: bars.length,
  };
}

export type ScreenKind = 'MOMENTUM' | 'PULLBACK' | 'STEADY';

export interface FocusPick {
  ticker: string;
  screen: ScreenKind;
  reason: string;
}

export const SCREEN_RULES: Record<ScreenKind, { title: string; rule: string }> = {
  MOMENTUM: { title: 'Strong recent trend', rule: 'Up at least 8% over three months and within 6% of its 60-session high. Ranked by three-month gain.' },
  PULLBACK: { title: 'Pulled back from a high', rule: 'Between 10% and 25% below its 60-session high, and not down more than 20% over three months. Ranked by the size of the pullback.' },
  STEADY: { title: 'Calm and liquid', rule: 'Among the lowest day-to-day price swings over 60 sessions, with a three-month move of no more than 15% either way. Ranked by calmness.' },
};

const kesShort = (n: number) => (n >= 1e9 ? `KSh ${round(n / 1e9, 2)}B` : n >= 1e6 ? `KSh ${round(n / 1e6, 1)}M` : `KSh ${Math.round(n).toLocaleString('en-KE')}`);

export function reasonFor(screen: ScreenKind, f: StockFacts): string {
  const liquidity = `It trades about ${kesShort(f.avgDailyValueKes)} a day.`;
  if (screen === 'MOMENTUM') return `${f.ticker} is up ${round(f.ret3mPct ?? 0)}% over three months and closed ${round(Math.abs(f.fromHighPct))}% below its 60-session high. ${liquidity}`;
  if (screen === 'PULLBACK') {
    const r = f.ret3mPct ?? 0;
    return `${f.ticker} is ${round(Math.abs(f.fromHighPct))}% below its 60-session high of KSh ${f.high60.toFixed(2)}, and ${r >= 0 ? 'up' : 'down'} ${round(Math.abs(r))}% over three months. ${liquidity}`;
  }
  return `${f.ticker} has moved about ${round(f.volatilityPct, 2)}% a day on average over 60 sessions, calmer than most liquid stocks, and is ${(f.ret3mPct ?? 0) >= 0 ? 'up' : 'down'} ${round(Math.abs(f.ret3mPct ?? 0))}% over three months. ${liquidity}`;
}

/** Up to `perScreen` stocks from each screen, no stock twice. `universe` is how many liquid stocks were screened. */
export function screenFocusList(all: StockFacts[], perScreen = 2): { picks: FocusPick[]; universe: number } {
  const liquid = all.filter((f) => f.avgDailyValueKes >= MIN_AVG_VALUE_KES && f.sessions >= MIN_SESSIONS);
  const used = new Set<string>();
  const picks: FocusPick[] = [];
  const take = (screen: ScreenKind, ranked: StockFacts[]) => {
    let n = 0;
    for (const f of ranked) {
      if (n >= perScreen) break;
      if (used.has(f.ticker)) continue;
      used.add(f.ticker);
      picks.push({ ticker: f.ticker, screen, reason: reasonFor(screen, f) });
      n++;
    }
  };
  take('MOMENTUM', liquid.filter((f) => (f.ret3mPct ?? -1) >= 8 && f.fromHighPct >= -6).sort((a, b) => (b.ret3mPct ?? 0) - (a.ret3mPct ?? 0)));
  take('PULLBACK', liquid.filter((f) => f.fromHighPct <= -10 && f.fromHighPct >= -25 && (f.ret3mPct ?? 0) > -20).sort((a, b) => a.fromHighPct - b.fromHighPct));
  take('STEADY', liquid.filter((f) => f.ret3mPct != null && Math.abs(f.ret3mPct) <= 15).sort((a, b) => a.volatilityPct - b.volatilityPct));
  return { picks, universe: liquid.length };
}

// ---- drafts: the facts and the plain statement of method; the reviewer adds the analysis

export interface NoteDraft {
  slug: string;
  title: string;
  summary: string;
  body: string;
  tickers: string[];
  period: string | null;
  facts: unknown;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

export function draftFocusList(period: string, picks: FocusPick[], facts: StockFacts[], universe: number): NoteDraft {
  const by = new Map(facts.map((f) => [f.ticker, f]));
  const asOf = facts.map((f) => f.asOf).sort().pop() ?? '';
  const screens = [...new Set(picks.map((p) => p.screen))];
  const body = [
    `Each month we run three fixed screens over the NSE stocks that trade at least ${kesShort(MIN_AVG_VALUE_KES)} a day (${universe} stocks this month, prices as of ${asOf}) and list what they surface. These are stocks worth researching further, not instructions to buy or sell anything.`,
    ...screens.map((s) => `${SCREEN_RULES[s].title}. ${SCREEN_RULES[s].rule}\n${picks.filter((p) => p.screen === s).map((p) => `- ${p.reason}`).join('\n')}`),
    `${REVIEWER_PLACEHOLDER}: replace this line with your own analysis of each stock before publishing.]`,
  ].join('\n\n');
  return {
    slug: `focus-list-${period}`,
    title: `Stocks worth researching: ${periodLabel(period)}`,
    summary: `${picks.length} liquid NSE stocks that stood out on three fixed screens in ${periodLabel(period)}, with the numbers behind each.`,
    body,
    tickers: picks.map((p) => p.ticker),
    period,
    facts: { kind: 'FOCUS_LIST', asOf, universe, minAvgValueKes: MIN_AVG_VALUE_KES, picks, stocks: picks.map((p) => by.get(p.ticker)).filter(Boolean) },
  };
}

const label = (f: Pick<StockFacts, 'name' | 'ticker'>) => (f.name && f.name !== f.ticker ? `${f.name} (${f.ticker})` : f.ticker);

export function draftBrief(f: StockFacts): NoteDraft {
  const r1 = f.ret1mPct != null ? `${f.ret1mPct >= 0 ? 'up' : 'down'} ${round(Math.abs(f.ret1mPct))}% over the last month` : 'without a full month of history';
  const r3 = f.ret3mPct != null ? `${f.ret3mPct >= 0 ? 'up' : 'down'} ${round(Math.abs(f.ret3mPct))}% over three months` : 'without three months of history';
  const body = [
    `${label(f)}${f.sector ? ` is listed in the ${f.sector} sector.` : '.'} It closed at KSh ${f.price.toFixed(2)} on ${f.asOf}, ${r1} and ${r3}.`,
    `Over the last 60 sessions its range was KSh ${f.low60.toFixed(2)} to KSh ${f.high60.toFixed(2)}. The close is ${round(Math.abs(f.fromHighPct))}% ${f.fromHighPct === 0 ? 'at' : 'below'} the high and ${round(f.fromLowPct)}% above the low. Its daily price moves average about ${round(f.volatilityPct, 2)}%, and it trades about ${kesShort(f.avgDailyValueKes)} a day, which tells you how easily a position can be bought or sold.`,
    `${REVIEWER_PLACEHOLDER}: replace this line with your own analysis of the business, results and risks before publishing.]`,
  ].join('\n\n');
  return {
    slug: `brief-${f.ticker.toLowerCase()}`,
    title: `${label(f)}: research brief`,
    summary: `What the price and trading data show for ${f.name && f.name !== f.ticker ? f.name : f.ticker}, with a reviewer's analysis.`,
    body,
    tickers: [f.ticker],
    period: null,
    facts: { kind: 'BRIEF', asOf: f.asOf, stocks: [f] },
  };
}

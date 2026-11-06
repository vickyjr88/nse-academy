// The five-stock example shown in the marketing email. The tickers are a random draw from a real portfolio; the
// share counts and cost prices are invented (the cost is set so each position shows a different, realistic
// situation). Prices and every flag come from the real closes and the real portfolio-watch rules.

import { boundsForYmd } from '../reports/report-helpers';
import { DailyClose, WatchItem, WatchKind, evaluateWatch } from '../portfolio-watch/portfolio-watch';
import { ExampleWatch } from './subscription-email';

export interface ExamplePosition {
  ticker: string;
  quantity: number;
  /** Gain or loss on cost the example position should show at today's close. */
  gainPct: number;
}

export const EXAMPLE_POSITIONS: ExamplePosition[] = [
  { ticker: 'NSE', quantity: 1000, gainPct: 24 },
  { ticker: 'KEGN', quantity: 2500, gainPct: -16 },
  { ticker: 'UCHM', quantity: 12000, gainPct: -4 },
  { ticker: 'KPLC', quantity: 800, gainPct: 8 },
  { ticker: 'NBV', quantity: 9000, gainPct: 14 },
];

/** What a reader most wants to see first. */
const KIND_ORDER: WatchKind[] = ['TAKE_PROFIT', 'DRAWDOWN', 'MOVER', 'NEAR_LOW', 'NEAR_HIGH', 'CONCENTRATION'];

export const EXAMPLE_ITEM_LIMIT = 4;

/** null when any of the five has no price history, so the email goes out without the block rather than with a wrong one. */
export function buildExampleWatch(series: Map<string, DailyClose[]>, positions: ExamplePosition[] = EXAMPLE_POSITIONS): ExampleWatch | null {
  const latest = (t: string) => {
    const s = series.get(t);
    return s && s.length ? s.slice().sort((a, b) => a.date.localeCompare(b.date))[s.length - 1].price : null;
  };
  const prices = positions.map((p) => latest(p.ticker));
  if (prices.some((p) => p == null)) return null;

  const result = evaluateWatch(
    positions.map((p, i) => ({
      ticker: p.ticker,
      quantity: p.quantity,
      avgCost: Math.round(((prices[i] as number) / (1 + p.gainPct / 100)) * 100) / 100,
      costSource: 'MANUAL',
    })),
    series,
  );
  if (!result.asOf || result.holdings.length !== positions.length) return null;

  const rank = (i: WatchItem) => KIND_ORDER.indexOf(i.kind);
  const items = result.items.slice().sort((a, b) => rank(a) - rank(b)).slice(0, EXAMPLE_ITEM_LIMIT);
  return { asOf: result.asOf, asOfLabel: boundsForYmd(result.asOf).label, result, items };
}

// Pure rules for the portfolio-watch alerts. No database, no clock: everything arrives as arguments so the
// same function drives the evening email, the in-app preview and the unit tests.
//
// Wording is deliberately informational - "may be worth reviewing", never "sell". These are prompts to look,
// not advice, and they only ever quote numbers that come from the user's own holdings and our price history.

export interface WatchPosition {
  ticker: string;
  quantity: number;
  /** Average cost per share; null when the user has none recorded. */
  avgCost: number | null;
  /** IMPORT_PRICE = estimated from the import-day market price; MANUAL / TRADES = real. */
  costSource: string | null;
}

export interface DailyClose {
  /** Nairobi calendar date, YYYY-MM-DD. */
  date: string;
  price: number;
}

export type WatchKind = 'TAKE_PROFIT' | 'DRAWDOWN' | 'NEAR_HIGH' | 'NEAR_LOW' | 'CONCENTRATION' | 'MOVER';

export interface WatchItem {
  kind: WatchKind;
  ticker: string;
  /** `${kind}:${ticker}` - the cooldown key. */
  key: string;
  text: string;
  /** How many days to stay quiet about this observation after sending it. 0 = always fresh. */
  cooldownDays: number;
}

export interface WatchHolding {
  ticker: string;
  quantity: number;
  price: number;
  valueKes: number;
  weightPct: number;
  dayChangePct: number | null;
  avgCost: number | null;
  costEstimated: boolean;
  gainPct: number | null;
}

export interface WatchResult {
  asOf: string | null;
  valueKes: number;
  dayChangeKes: number;
  dayChangePct: number | null;
  costKes: number | null;
  unrealizedKes: number | null;
  unrealizedPct: number | null;
  /** True when any cost in the totals is an import-day estimate. */
  costEstimated: boolean;
  holdings: WatchHolding[];
  items: WatchItem[];
}

export const THRESHOLDS = {
  /** A single-day move at or beyond this is worth a line. */
  moverPct: 3,
  /** Up this much on cost: remind the user to check it against their own target. */
  takeProfitPct: 20,
  /** Down this much on cost. */
  drawdownPct: 15,
  /** Within this distance of the 60-session high/low. */
  nearExtremePct: 2,
  /** High/low must be at least this far apart (as a ratio) for "near the high/low" to mean something. */
  minRangeRatio: 1.1,
  /** Sessions of history needed before high/low is meaningful. */
  minSessions: 20,
  rangeSessions: 60,
  /** One holding at or above this share of the portfolio. */
  concentrationPct: 30,
  /** Concentration only means something with several holdings. */
  concentrationMinHoldings: 3,
  /** Ignore dust positions. */
  minPositionKes: 1_000,
} as const;

export const COOLDOWN_DAYS: Record<WatchKind, number> = {
  MOVER: 0,
  TAKE_PROFIT: 3,
  DRAWDOWN: 3,
  NEAR_HIGH: 5,
  NEAR_LOW: 5,
  CONCENTRATION: 14,
};

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const kes = (n: number) => `KSh ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
const px = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(round(n)).toFixed(1)}%`;

/** Several brokers can hold the same ticker: one line per ticker, cost weighted by quantity. */
export function consolidate(positions: WatchPosition[]): WatchPosition[] {
  const by = new Map<string, { quantity: number; cost: number; costed: number; estimated: boolean; allCosted: boolean }>();
  for (const p of positions) {
    if (p.quantity <= 0) continue;
    const e = by.get(p.ticker) ?? { quantity: 0, cost: 0, costed: 0, estimated: false, allCosted: true };
    e.quantity += p.quantity;
    if (p.avgCost != null) {
      e.cost += p.avgCost * p.quantity;
      e.costed += p.quantity;
    } else {
      e.allCosted = false;
    }
    if (p.costSource === 'IMPORT_PRICE') e.estimated = true;
    by.set(p.ticker, e);
  }
  return [...by.entries()].map(([ticker, e]) => ({
    ticker,
    quantity: e.quantity,
    avgCost: e.allCosted && e.costed > 0 ? e.cost / e.costed : null,
    costSource: e.estimated ? 'IMPORT_PRICE' : e.allCosted && e.costed > 0 ? 'MANUAL' : null,
  }));
}

export function evaluateWatch(rawPositions: WatchPosition[], series: Map<string, DailyClose[]>): WatchResult {
  const positions = consolidate(rawPositions);

  const holdings: WatchHolding[] = [];
  let asOf: string | null = null;
  for (const p of positions) {
    const closes = (series.get(p.ticker) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (closes.length === 0) continue;
    const last = closes[closes.length - 1];
    const prev = closes.length > 1 ? closes[closes.length - 2] : null;
    if (!asOf || last.date > asOf) asOf = last.date;
    const valueKes = p.quantity * last.price;
    holdings.push({
      ticker: p.ticker,
      quantity: p.quantity,
      price: last.price,
      valueKes,
      weightPct: 0,
      dayChangePct: prev && prev.price > 0 ? ((last.price - prev.price) / prev.price) * 100 : null,
      avgCost: p.avgCost,
      costEstimated: p.costSource === 'IMPORT_PRICE',
      gainPct: p.avgCost && p.avgCost > 0 ? ((last.price - p.avgCost) / p.avgCost) * 100 : null,
    });
  }

  const valueKes = holdings.reduce((s, h) => s + h.valueKes, 0);
  for (const h of holdings) h.weightPct = valueKes > 0 ? (h.valueKes / valueKes) * 100 : 0;
  holdings.sort((a, b) => b.valueKes - a.valueKes);

  let dayChangeKes = 0;
  let prevValue = 0;
  for (const h of holdings) {
    if (h.dayChangePct == null) {
      prevValue += h.valueKes;
      continue;
    }
    const prevPrice = h.price / (1 + h.dayChangePct / 100);
    dayChangeKes += h.quantity * (h.price - prevPrice);
    prevValue += h.quantity * prevPrice;
  }

  const allCosted = holdings.length > 0 && holdings.every((h) => h.avgCost != null);
  const costKes = allCosted ? holdings.reduce((s, h) => s + h.quantity * (h.avgCost as number), 0) : null;

  const result: WatchResult = {
    asOf,
    valueKes,
    dayChangeKes,
    dayChangePct: prevValue > 0 ? (dayChangeKes / prevValue) * 100 : null,
    costKes,
    unrealizedKes: costKes != null ? valueKes - costKes : null,
    unrealizedPct: costKes != null && costKes > 0 ? ((valueKes - costKes) / costKes) * 100 : null,
    costEstimated: holdings.some((h) => h.costEstimated),
    holdings,
    items: [],
  };

  const items: WatchItem[] = [];
  const add = (kind: WatchKind, ticker: string, text: string) =>
    items.push({ kind, ticker, key: `${kind}:${ticker}`, text, cooldownDays: COOLDOWN_DAYS[kind] });
  const T = THRESHOLDS;

  for (const h of holdings) {
    if (h.valueKes < T.minPositionKes) continue;
    const closes = (series.get(h.ticker) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const since = h.costEstimated ? ' since your portfolio was imported' : ' on your cost';
    const costNote = h.avgCost != null ? ` (${px(h.avgCost)}${h.costEstimated ? ', estimated from the price on import day' : ''} to ${px(h.price)})` : '';

    if (h.dayChangePct != null && Math.abs(h.dayChangePct) >= T.moverPct) {
      add('MOVER', h.ticker, `${h.ticker} ${signed(h.dayChangePct)} today, closing at ${px(h.price)}.`);
    }
    if (h.gainPct != null && h.gainPct >= T.takeProfitPct) {
      add('TAKE_PROFIT', h.ticker, `${h.ticker} is up ${round(h.gainPct)}%${since}${costNote}. If you set yourself a profit target, this is a good time to check it.`);
    }
    if (h.gainPct != null && h.gainPct <= -T.drawdownPct) {
      add('DRAWDOWN', h.ticker, `${h.ticker} is down ${round(Math.abs(h.gainPct))}%${since}${costNote}. Worth checking that your reasons for holding it still stand.`);
    }

    const window = closes.slice(-T.rangeSessions);
    if (window.length >= T.minSessions) {
      const hi = Math.max(...window.map((c) => c.price));
      const lo = Math.min(...window.map((c) => c.price));
      if (lo > 0 && hi / lo >= T.minRangeRatio) {
        if (h.price >= hi * (1 - T.nearExtremePct / 100)) {
          add('NEAR_HIGH', h.ticker, h.price >= hi
            ? `${h.ticker} closed at ${px(h.price)}, its highest close in ${window.length} sessions.`
            : `${h.ticker} closed at ${px(h.price)}, within ${T.nearExtremePct}% of its ${window.length}-session high (${px(hi)}).`);
        } else if (h.price <= lo * (1 + T.nearExtremePct / 100)) {
          add('NEAR_LOW', h.ticker, h.price <= lo
            ? `${h.ticker} closed at ${px(h.price)}, its lowest close in ${window.length} sessions.`
            : `${h.ticker} closed at ${px(h.price)}, within ${T.nearExtremePct}% of its ${window.length}-session low (${px(lo)}).`);
        }
      }
    }
  }

  if (holdings.length >= T.concentrationMinHoldings) {
    for (const h of holdings) {
      if (h.weightPct >= T.concentrationPct) {
        add('CONCENTRATION', h.ticker, `${h.ticker} is ${Math.round(h.weightPct)}% of your portfolio value (${kes(h.valueKes)}). A big share in one stock means its moves drive your results.`);
      }
    }
  }

  result.items = items;
  return result;
}

/** Drops items that were already sent inside their cooldown. `lastSent` maps key -> most recent send. */
export function applyCooldowns(items: WatchItem[], lastSent: Map<string, Date>, now: Date): WatchItem[] {
  return items.filter((i) => {
    if (i.cooldownDays === 0) return true;
    const last = lastSent.get(i.key);
    return !last || now.getTime() - last.getTime() >= i.cooldownDays * 86_400_000;
  });
}

/**
 * Pure helpers for the daily admin report - no database, no Nest - so the
 * date math and market-mover logic can be unit tested directly.
 */

/** Nairobi is UTC+3 all year (no daylight saving), so a fixed offset is exact. */
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayBounds {
  /** Calendar date in Nairobi, YYYY-MM-DD. */
  ymd: string;
  /** e.g. "Tuesday 3 November 2026" */
  label: string;
  /** Short form for subject lines, e.g. "Tue 3 Nov". */
  shortLabel: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  /** Inclusive start / exclusive end of that Nairobi day, as real instants. */
  start: Date;
  end: Date;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Labels are built from fixed name tables, not Intl: Intl output (commas,
// abbreviations) varies with the Node/ICU build, and the report must read the
// same on a laptop and in the production container.
function boundsFromEatMidnight(eatMidnightAsUtcMs: number): DayBounds {
  const d = new Date(eatMidnightAsUtcMs);
  const start = new Date(eatMidnightAsUtcMs - EAT_OFFSET_MS);
  const weekday = d.getUTCDay();
  const dom = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  return {
    ymd: d.toISOString().slice(0, 10),
    label: `${WEEKDAYS[weekday]} ${dom} ${month} ${d.getUTCFullYear()}`,
    shortLabel: `${WEEKDAYS[weekday].slice(0, 3)} ${dom} ${month.slice(0, 3)}`,
    weekday,
    start,
    end: new Date(start.getTime() + DAY_MS),
  };
}

/** The Nairobi calendar day `daysAgo` days before the day `now` falls in (1 = yesterday). */
export function eatDayBounds(now: Date, daysAgo = 1): DayBounds {
  const eat = new Date(now.getTime() + EAT_OFFSET_MS);
  const todayMidnight = Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate());
  return boundsFromEatMidnight(todayMidnight - daysAgo * DAY_MS);
}

export function boundsForYmd(ymd: string): DayBounds {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Invalid date "${ymd}", expected YYYY-MM-DD`);
  return boundsFromEatMidnight(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** "1,234.5", "5.93 K", "2.1M", "-1.89" -> number. Unparseable -> 0. */
export function parseNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (!raw) return 0;
  const m = /^(-?[\d,]*\.?\d+)\s*([KMB])?/i.exec(String(raw).trim());
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
  return Number.isFinite(n) ? n * mult : 0;
}

export interface PriceRow {
  ticker: string;
  name: string;
  price: number;
  /** Share count as the market API stores it, e.g. "406809". */
  volume: string;
  /** Day change vs previous close as a percent string, e.g. "3.56" or "-1.89". */
  change: string;
}

export interface Mover {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  /** price x volume - a share count alone is meaningless across a KSh 1 stock and a KSh 1,000 one. */
  value: number;
}

export interface MarketSummary {
  gainers: Mover[];
  losers: Mover[];
  active: Mover[];
  advancers: number;
  decliners: number;
  unchanged: number;
  /** Tickers that actually traded (volume > 0). */
  traded: number;
  totalValue: number;
}

/**
 * Gainers/losers need at least this much traded (price x volume) to count.
 * Without it the lists fill with a few shares changing hands at odd prices
 * (e.g. +7% on 113 shares) - a "mover" nobody can actually trade.
 */
export const MIN_MOVER_VALUE_KES = 100_000;

export function computeMovers(rows: PriceRow[], n = 5, minValue = MIN_MOVER_VALUE_KES): MarketSummary {
  const all: Mover[] = rows.map((r) => {
    const volume = parseNumber(r.volume);
    return {
      ticker: r.ticker,
      name: r.name,
      price: r.price,
      changePct: parseNumber(r.change),
      volume,
      value: r.price * volume,
    };
  });
  // A stock that never traded carries a stale/zero change - keep it out of the rankings.
  const traded = all.filter((m) => m.volume > 0);
  const liquid = traded.filter((m) => m.value >= minValue);
  return {
    gainers: liquid.filter((m) => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, n),
    losers: liquid.filter((m) => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, n),
    active: [...traded].sort((a, b) => b.value - a.value).slice(0, n),
    advancers: traded.filter((m) => m.changePct > 0).length,
    decliners: traded.filter((m) => m.changePct < 0).length,
    unchanged: traded.filter((m) => m.changePct === 0).length,
    traded: traded.length,
    totalValue: traded.reduce((sum, m) => sum + m.value, 0),
  };
}

export function formatKes(n: number): string {
  return `KSh ${Math.round(n).toLocaleString('en-KE')}`;
}

/** 1_250_000 -> "1.25M", 48_300 -> "48.3K". */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${+(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

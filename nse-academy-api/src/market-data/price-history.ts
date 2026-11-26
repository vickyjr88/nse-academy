import { PrismaService } from '../prisma/prisma.service';
import { parseNumber } from '../reports/report-helpers';

export interface DailyClose {
  /** Nairobi calendar date, YYYY-MM-DD. */
  date: string;
  price: number;
}

/**
 * The last recorded price of each Nairobi trading day, per ticker, oldest first. Snapshots arrive every
 * few minutes, so "the close" is the final snapshot of the day. Zero prices (parse failures) are ignored. Looks back `lookbackDays` (default 120, about 80 sessions).
 */
export async function loadDailyCloses(prisma: PrismaService, tickers: string[], lookbackDays = 120): Promise<Map<string, DailyClose[]>> {
  const days = Math.min(Math.max(Math.floor(lookbackDays) || 120, 1), 800);
  const map = new Map<string, DailyClose[]>();
  if (tickers.length === 0) return map;
  const rows = await prisma.$queryRaw<{ ticker: string; d: string; price: number }[]>`
    SELECT DISTINCT ON (ticker, d) ticker, d, price FROM (
      SELECT ticker,
             to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS d,
             price, timestamp
      FROM "StockPrice"
      WHERE ticker = ANY(${tickers}::text[]) AND price > 0 AND timestamp > now() - make_interval(days => ${days}::int)
    ) x
    ORDER BY ticker, d, timestamp DESC`;
  for (const r of rows) {
    const list = map.get(r.ticker) ?? [];
    list.push({ date: r.d, price: Number(r.price) });
    map.set(r.ticker, list);
  }
  return map;
}

export interface DailyBar {
  /** Nairobi calendar date, YYYY-MM-DD. */
  date: string;
  price: number;
  /** Value traded that day in KSh: the last snapshot's cumulative volume times its price. */
  valueKes: number;
}

/** "1,234", "2.5K", "1.2M" -> number. The market API stores volume as text. */
export function parseVolume(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (!raw) return 0;
  const m = /^(-?[\d,]*\.?\d+)\s*([KMB])?/i.exec(String(raw).trim());
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/,/g, ''));
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? '').toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
  return Number.isFinite(n) ? n * mult : 0;
}

/** Like loadDailyCloses but also carries each day's value traded, for every ticker (or just the ones named). */
export async function loadDailyBars(prisma: PrismaService, tickers: string[] | null, lookbackDays = 120): Promise<Map<string, DailyBar[]>> {
  const days = Math.min(Math.max(Math.floor(lookbackDays) || 120, 1), 800);
  const rows = await prisma.$queryRaw<{ ticker: string; d: string; price: number; volume: string }[]>`
    SELECT DISTINCT ON (ticker, d) ticker, d, price, volume FROM (
      SELECT ticker,
             to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS d,
             price, volume, timestamp
      FROM "StockPrice"
      WHERE (${tickers}::text[] IS NULL OR ticker = ANY(${tickers}::text[])) AND price > 0 AND timestamp > now() - make_interval(days => ${days}::int)
    ) x
    ORDER BY ticker, d, timestamp DESC`;
  const map = new Map<string, DailyBar[]>();
  for (const r of rows) {
    const list = map.get(r.ticker) ?? [];
    list.push({ date: r.d, price: Number(r.price), valueKes: Number(r.price) * parseVolume(r.volume) });
    map.set(r.ticker, list);
  }
  return map;
}

export interface DailyPoint {
  /** Nairobi calendar date, YYYY-MM-DD. */
  date: string;
  price: number;
  /** The feed's own change on the day, in percent. */
  changePct: number;
  /** Shares traded that day. */
  volume: number;
}

export interface DaySnapshot {
  d: string;
  price: number;
  volume: string;
  change: string;
}

/**
 * One ticker's last snapshot of each day (oldest first) as chart points. A day that repeats the one before it exactly
 * (price, volume and change) is the feed not refreshing, on a holiday or a late update, so it is left out and counted
 * rather than drawn as a flat session that traded the same number of shares again.
 */
export function toDailyPoints(rows: DaySnapshot[]): { points: DailyPoint[]; repeatedDays: number } {
  const points: DailyPoint[] = [];
  let previous: DaySnapshot | null = null;
  let repeatedDays = 0;
  for (const r of rows) {
    if (!(r.price > 0)) continue;
    if (previous && r.price === previous.price && r.volume === previous.volume && r.change === previous.change) {
      repeatedDays++;
      continue;
    }
    previous = r;
    points.push({ date: r.d, price: Number(r.price), changePct: parseNumber(r.change), volume: parseVolume(r.volume) });
  }
  return { points, repeatedDays };
}

/** The last snapshot of every day we hold for one ticker, oldest first. */
export async function loadDaySnapshots(prisma: PrismaService, ticker: string): Promise<(DaySnapshot & { name: string })[]> {
  return prisma.$queryRaw<(DaySnapshot & { name: string })[]>`
    SELECT DISTINCT ON (d) d, name, price, volume, change FROM (
      SELECT to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS d,
             name, price, volume, change, timestamp
      FROM "StockPrice"
      WHERE ticker = ${ticker} AND price > 0
    ) x
    ORDER BY d, timestamp DESC`;
}

export interface TickerClose {
  ticker: string;
  price: number;
  volume: string;
  change: string;
}

/** On a normal day well under a fifth of the market is unchanged in price, volume and change; a repeat is nearly all of it. */
const REPEAT_SHARE = 0.9;
const MIN_COMPARED = 10;

/**
 * Is `day` only the previous day's numbers again? That is what a holiday looks like, and a feed that has not updated
 * yet. A report built from it would present old trading as new.
 */
export function repeatsPreviousDay(day: TickerClose[], previous: TickerClose[]): boolean {
  const before = new Map(previous.map((r) => [r.ticker, r]));
  let compared = 0;
  let same = 0;
  for (const r of day) {
    const p = before.get(r.ticker);
    if (!p) continue;
    compared++;
    if (p.price === r.price && p.volume === r.volume && p.change === r.change) same++;
  }
  return compared >= MIN_COMPARED && same / compared > REPEAT_SHARE;
}

export type SessionState = 'new' | 'repeat' | 'missing';

/** What we hold for a Nairobi day: nothing, a repeat of the day before, or new trading. */
export async function loadSessionState(prisma: PrismaService, ymd: string): Promise<SessionState> {
  const rows = await prisma.$queryRaw<(TickerClose & { d: string })[]>`
    WITH bars AS (
      SELECT ticker, price, volume, change, timestamp,
             to_char((timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Nairobi', 'YYYY-MM-DD') AS d
      FROM "StockPrice"
      WHERE price > 0 AND ticker <> ''
        AND timestamp > (${ymd}::date - 15)::timestamp AND timestamp < (${ymd}::date + 2)::timestamp
    ), days AS (
      SELECT DISTINCT d FROM bars WHERE d <= ${ymd} ORDER BY d DESC LIMIT 2
    )
    SELECT DISTINCT ON (ticker, d) ticker, d, price, volume, change FROM bars
    WHERE d IN (SELECT d FROM days)
    ORDER BY ticker, d, timestamp DESC`;
  const day = rows.filter((r) => r.d === ymd);
  if (day.length === 0) return 'missing';
  return repeatsPreviousDay(day, rows.filter((r) => r.d !== ymd)) ? 'repeat' : 'new';
}

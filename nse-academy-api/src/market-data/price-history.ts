import { PrismaService } from '../prisma/prisma.service';

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

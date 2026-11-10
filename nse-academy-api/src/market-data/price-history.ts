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

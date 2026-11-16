import { LISTED_AS_OF, LISTED_COMPANIES, type ListedCompany } from './listed-companies';

export interface QuoteRow {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  updatedAt: Date;
}

export interface HeatmapTile {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  /** price x shares in issue, in KES. */
  marketCap: number;
}

export interface HeatmapSector {
  sector: string;
  marketCap: number;
  /** Market-cap-weighted day change of the sector's tiles, in percent. */
  changePct: number;
  count: number;
}

export interface Heatmap {
  /** Latest quote time among the tiles. */
  asOf: string | null;
  sharesAsOf: string;
  totalMarketCap: number;
  /** Market-cap-weighted day change of every tile, in percent. */
  changePct: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  sectors: HeatmapSector[];
  tiles: HeatmapTile[];
}

/** A price older than this is a delisted or suspended counter, not today's market. */
export const STALE_AFTER_DAYS = 7;

/** Day changes of 0.005% or less count as unchanged, so a rounding wobble does not read as a mover. */
const FLAT = 0.005;

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

function weighted(rows: { marketCap: number; changePct: number }[]): number {
  const total = rows.reduce((s, r) => s + r.marketCap, 0);
  return total > 0 ? rows.reduce((s, r) => s + r.marketCap * r.changePct, 0) / total : 0;
}

/**
 * Turns the latest quotes into the heatmap: one tile per listed company that has a current price and a known share count,
 * biggest first. Tickers we hold no share count for (exchange-traded funds, preference shares, a blank ticker in the feed)
 * and stale quotes are left out rather than guessed at.
 */
export function buildHeatmap(quotes: QuoteRow[], now: Date = new Date(), listed: Record<string, ListedCompany> = LISTED_COMPANIES): Heatmap {
  const cutoff = now.getTime() - STALE_AFTER_DAYS * 86_400_000;
  const tiles: HeatmapTile[] = [];
  for (const q of quotes) {
    const company = listed[q.ticker];
    if (!company || !(q.price > 0) || !Number.isFinite(q.changePct) || q.updatedAt.getTime() < cutoff) continue;
    tiles.push({
      ticker: q.ticker,
      name: q.name,
      sector: company.sector,
      price: q.price,
      changePct: round(q.changePct, 2),
      marketCap: Math.round(q.price * company.shares),
    });
  }
  tiles.sort((a, b) => b.marketCap - a.marketCap);

  const bySector = new Map<string, HeatmapTile[]>();
  for (const t of tiles) bySector.set(t.sector, [...(bySector.get(t.sector) ?? []), t]);
  const sectors = [...bySector.entries()]
    .map(([sector, rows]) => ({
      sector,
      marketCap: rows.reduce((s, r) => s + r.marketCap, 0),
      changePct: round(weighted(rows), 2),
      count: rows.length,
    }))
    .sort((a, b) => b.marketCap - a.marketCap);

  const latest = quotes.filter((q) => tiles.some((t) => t.ticker === q.ticker)).reduce<Date | null>((m, q) => (!m || q.updatedAt > m ? q.updatedAt : m), null);

  return {
    asOf: latest ? latest.toISOString() : null,
    sharesAsOf: LISTED_AS_OF,
    totalMarketCap: tiles.reduce((s, t) => s + t.marketCap, 0),
    changePct: round(weighted(tiles), 2),
    advancers: tiles.filter((t) => t.changePct > FLAT).length,
    decliners: tiles.filter((t) => t.changePct < -FLAT).length,
    unchanged: tiles.filter((t) => Math.abs(t.changePct) <= FLAT).length,
    sectors,
    tiles,
  };
}

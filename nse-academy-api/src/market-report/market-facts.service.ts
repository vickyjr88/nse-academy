import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceRow, boundsForYmd, parseNumber } from '../reports/report-helpers';
import { DayValue, MarketFacts, buildFacts } from './market-facts';

const HISTORY_DAYS = 45; // calendar days of earlier sessions to build the 20-session baseline from
const SECTOR_TTL_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class MarketFactsService {
  private readonly logger = new Logger(MarketFactsService.name);
  private sectorCache: { at: number; map: Record<string, string> } | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /** The most recent Nairobi trading day with price data that ended before `before`. */
  async latestSessionYmd(before: Date): Promise<string | null> {
    const from = new Date(before.getTime() - 14 * 24 * 60 * 60 * 1000);
    const [row] = await this.prisma.$queryRaw<{ d: string | null }[]>(Prisma.sql`
      select max((("timestamp" at time zone 'Africa/Nairobi')::date))::text as d
      from "StockPrice"
      where "timestamp" < ${before} and "timestamp" >= ${from}`);
    return row?.d ?? null;
  }

  async build(sessionYmd: string): Promise<MarketFacts> {
    const day = boundsForYmd(sessionYmd);

    // The last snapshot of each ticker that day = closing price + the day's % change.
    const rows = await this.prisma.$queryRaw<PriceRow[]>(Prisma.sql`
      select distinct on (ticker) ticker, name, price, volume, change
      from "StockPrice"
      where "timestamp" >= ${day.start} and "timestamp" < ${day.end}
      order by ticker, "timestamp" desc`);
    if (rows.length === 0) throw new NotFoundException(`No price data for ${sessionYmd}`);

    const from = new Date(day.start.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const hist = await this.prisma.$queryRaw<{ ticker: string; ymd: string; price: number; volume: string; change: string }[]>(Prisma.sql`
      select distinct on (ticker, d) ticker, d::text as ymd, price, volume, change
      from (
        select ticker, price, volume, change, "timestamp",
               (("timestamp" at time zone 'Africa/Nairobi')::date) as d
        from "StockPrice"
        where "timestamp" >= ${from} and "timestamp" < ${day.start}
      ) t
      order by ticker, d, "timestamp" desc`);

    const history: Record<string, DayValue[]> = {};
    for (const h of hist) {
      (history[h.ticker] ??= []).push({ ymd: h.ymd, value: h.price * parseNumber(h.volume), changePct: parseNumber(h.change) });
    }
    for (const days of Object.values(history)) days.sort((a, b) => a.ymd.localeCompare(b.ymd));

    return buildFacts({
      sessionYmd,
      label: day.label,
      shortLabel: day.shortLabel,
      weekday: day.weekday,
      rows,
      history,
      sectors: await this.sectors(),
    });
  }

  /**
   * ticker -> sector from the CMS stock profiles. Sector analysis is a nice-to-
   * have: if the CMS is unreachable the report is built without it.
   */
  private async sectors(): Promise<Record<string, string>> {
    if (this.sectorCache && Date.now() - this.sectorCache.at < SECTOR_TTL_MS) return this.sectorCache.map;
    const base = this.config.get<string>('CMS_URL', 'http://localhost:1337');
    const token = this.config.get<string>('CMS_API_TOKEN');
    try {
      const res = await fetch(`${base}/api/stock-profiles?pagination[pageSize]=200&fields[0]=ticker&fields[1]=sector`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const map: Record<string, string> = {};
      for (const item of json.data ?? []) {
        const a = item.attributes ?? item;
        if (a.ticker && a.sector) map[String(a.ticker).toUpperCase()] = String(a.sector);
      }
      this.sectorCache = { at: Date.now(), map };
      return map;
    } catch (err) {
      this.logger.warn(`Sector lookup failed, building the report without sectors: ${(err as Error).message}`);
      return this.sectorCache?.map ?? {};
    }
  }
}

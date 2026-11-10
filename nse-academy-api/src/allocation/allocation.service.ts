import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { loadDailyCloses } from '../market-data/price-history';
import { MarketFactsService } from '../market-report/market-facts.service';
import {
  AllocationRow,
  Position,
  RebalancePlan,
  SectorRow,
  Target,
  allocationRows,
  consolidatePositions,
  planRebalance,
  sectorExposure,
  validateTargets,
} from './rebalance';

/** One share of the portfolio in a single stock or sector at or above this is worth pointing out. */
export const CONCENTRATION_PCT = 30;

export interface AllocationOverview {
  valueKes: number;
  rows: AllocationRow[];
  sectors: SectorRow[];
  /** Holdings with no recent price: left out of the weights. */
  unpriced: string[];
  notes: string[];
  targets: Target[];
}

export interface LoadedPortfolio {
  positions: Position[];
  unpriced: string[];
  extraPrices: Record<string, number>;
  defaultFeePct: number | null;
  defaultBrokerName: string | null;
}

@Injectable()
export class AllocationService {
  constructor(
    private prisma: PrismaService,
    private facts: MarketFactsService,
  ) {}

  /** The member's holdings priced at the last close, plus prices for targeted stocks they do not hold. */
  async loadPortfolio(userId: string, extraTickers: string[] = []): Promise<LoadedPortfolio> {
    const holdings = await this.prisma.holding.findMany({ where: { userId, quantity: { gt: 0 } }, include: { broker: true } });
    const tickers = [...new Set([...holdings.map((h) => h.ticker), ...extraTickers])];
    const series = await loadDailyCloses(this.prisma, tickers);
    const last = (t: string) => {
      const s = series.get(t);
      return s && s.length ? s[s.length - 1].price : null;
    };

    const unpriced: string[] = [];
    const raw: Parameters<typeof consolidatePositions>[0] = [];
    for (const h of holdings) {
      const price = last(h.ticker);
      if (price == null) {
        if (!unpriced.includes(h.ticker)) unpriced.push(h.ticker);
        continue;
      }
      raw.push({ ticker: h.ticker, quantity: h.quantity, price, feePct: h.broker.feePercent, brokerName: h.broker.name });
    }
    const positions = consolidatePositions(raw);

    const extraPrices: Record<string, number> = {};
    for (const t of extraTickers) {
      const p = last(t);
      if (p != null) extraPrices[t] = p;
    }

    // A stock bought for the first time goes through the broker the member already holds most with.
    const valueByBroker = new Map<string, { value: number; fee: number; name: string }>();
    for (const h of holdings) {
      const price = last(h.ticker);
      if (price == null) continue;
      const e = valueByBroker.get(h.broker.id) ?? { value: 0, fee: h.broker.feePercent, name: h.broker.name };
      e.value += h.quantity * price;
      valueByBroker.set(h.broker.id, e);
    }
    const main = [...valueByBroker.values()].sort((a, b) => b.value - a.value)[0];
    return { positions, unpriced, extraPrices, defaultFeePct: main?.fee ?? null, defaultBrokerName: main?.name ?? null };
  }

  async getTargets(userId: string): Promise<Target[]> {
    const rows = await this.prisma.allocationTarget.findMany({ where: { userId }, orderBy: [{ weightPct: 'desc' }, { ticker: 'asc' }] });
    return rows.map((r) => ({ ticker: r.ticker, weightPct: r.weightPct }));
  }

  /** Replaces the member's targets. An empty list clears them. */
  async setTargets(userId: string, targets: Target[]): Promise<Target[]> {
    const clean = targets.map((t) => ({ ticker: String(t.ticker).trim().toUpperCase(), weightPct: Math.round(Number(t.weightPct) * 100) / 100 }));
    const problems = validateTargets(clean);
    if (problems.length) throw new BadRequestException(problems.join(' '));
    await this.prisma.$transaction([
      this.prisma.allocationTarget.deleteMany({ where: { userId } }),
      ...(clean.length ? [this.prisma.allocationTarget.createMany({ data: clean.map((t) => ({ userId, ticker: t.ticker, weightPct: t.weightPct })) })] : []),
    ]);
    return this.getTargets(userId);
  }

  async overview(userId: string): Promise<AllocationOverview> {
    const [loaded, sectorMap, targets] = await Promise.all([this.loadPortfolio(userId), this.facts.sectorMap(), this.getTargets(userId)]);
    const rows = allocationRows(loaded.positions, sectorMap);
    const sectors = sectorExposure(rows);
    const notes: string[] = [];
    for (const r of rows) if (rows.length >= 3 && r.weightPct >= CONCENTRATION_PCT) notes.push(`${r.ticker} is ${Math.round(r.weightPct)}% of your portfolio.`);
    for (const s of sectors) if (s.sector !== 'Unclassified' && s.tickers.length >= 2 && s.weightPct >= 50) notes.push(`${Math.round(s.weightPct)}% of your portfolio is in ${s.sector}, across ${s.tickers.length} stocks.`);
    if (loaded.unpriced.length) notes.push(`${loaded.unpriced.join(', ')} ${loaded.unpriced.length === 1 ? 'has' : 'have'} no recent price and ${loaded.unpriced.length === 1 ? 'is' : 'are'} left out.`);
    return { valueKes: Math.round(rows.reduce((s, r) => s + r.valueKes, 0)), rows, sectors, unpriced: loaded.unpriced, notes, targets };
  }

  async plan(userId: string, cashKes = 0): Promise<RebalancePlan & { targets: Target[] }> {
    const targets = await this.getTargets(userId);
    if (targets.length === 0) throw new BadRequestException('Set your target weights first.');
    const loaded = await this.loadPortfolio(userId, targets.map((t) => t.ticker));
    const plan = planRebalance({
      positions: loaded.positions,
      targets,
      extraPrices: loaded.extraPrices,
      defaultFeePct: loaded.defaultFeePct,
      defaultBrokerName: loaded.defaultBrokerName,
      cashKes,
    });
    return { ...plan, targets };
  }
}

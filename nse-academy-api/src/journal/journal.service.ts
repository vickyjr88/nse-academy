import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { CreateDividendDto } from './dto/create-dividend.dto';
import { UpdateDividendDto } from './dto/update-dividend.dto';
import { parseCdscStatement } from './statement-parser';

interface LatestStockPriceRow {
  ticker: string;
  price: number;
}

const YIELD_LOOKBACK_DAYS = 365;

@Injectable()
export class JournalService {
  private readonly logger = new Logger(JournalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketData: MarketDataService,
  ) {}

  private async findBrokerOrThrow(brokerId: string) {
    const broker = await this.prisma.broker.findUnique({ where: { id: brokerId } });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  private computeTotal(side: string, quantity: number, pricePerShare: number, feesKes: number) {
    const gross = quantity * pricePerShare;
    return side === 'BUY' ? gross + feesKes : gross - feesKes;
  }

  // Recomputes both the Holding (quantity/avgCost) and RealizedGain rows for a
  // (user, broker, ticker) from scratch, replaying trades in date order. The
  // replay order matters: a SELL's realized gain must use the avgCost
  // accumulated from BUYs seen so far, not the final avgCost - otherwise an
  // early SELL would look ahead at cost movement from later BUYs.
  private async syncHolding(userId: string, brokerId: string, ticker: string, companyName: string | null | undefined) {
    const trades = await this.prisma.trade.findMany({
      where: { userId, brokerId, ticker },
      orderBy: { tradeDate: 'asc' },
    });

    let quantity = 0;
    let totalCost = 0;
    let costedQuantity = 0;
    const sellTradeIds: string[] = [];
    const gainRows: {
      tradeId: string;
      quantity: number;
      proceedsKes: number;
      costBasisKes: number;
      realizedGainKes: number;
      tradeDate: Date;
    }[] = [];

    for (const t of trades) {
      if (t.side === 'BUY') {
        quantity += t.quantity;
        totalCost += t.quantity * t.pricePerShare + t.feesKes;
        costedQuantity += t.quantity;
      } else {
        const avgCostAtSale = costedQuantity > 0 ? totalCost / costedQuantity : 0;
        const proceedsKes = t.quantity * t.pricePerShare - t.feesKes;
        const costBasisKes = t.quantity * avgCostAtSale;

        sellTradeIds.push(t.id);
        gainRows.push({
          tradeId: t.id,
          quantity: t.quantity,
          proceedsKes,
          costBasisKes,
          realizedGainKes: proceedsKes - costBasisKes,
          tradeDate: t.tradeDate,
        });

        quantity -= t.quantity;
        totalCost -= t.quantity * avgCostAtSale;
        costedQuantity -= t.quantity;
      }
    }

    const avgCost = costedQuantity > 0 ? totalCost / costedQuantity : null;

    await this.prisma.holding.upsert({
      where: { userId_brokerId_ticker: { userId, brokerId, ticker } },
      update: { quantity, avgCost, costSource: avgCost != null ? 'TRADES' : null, costDate: avgCost != null ? new Date() : null, companyName: companyName ?? undefined },
      create: {
        userId,
        brokerId,
        ticker,
        companyName: companyName ?? ticker,
        quantity,
        avgCost,
        costSource: avgCost != null ? 'TRADES' : null,
        costDate: avgCost != null ? new Date() : null,
      },
    });

    await this.prisma.realizedGain.deleteMany({
      where: { userId, brokerId, ticker, tradeId: { notIn: sellTradeIds } },
    });
    for (const g of gainRows) {
      await this.prisma.realizedGain.upsert({
        where: { tradeId: g.tradeId },
        update: {
          quantity: g.quantity,
          proceedsKes: g.proceedsKes,
          costBasisKes: g.costBasisKes,
          realizedGainKes: g.realizedGainKes,
          tradeDate: g.tradeDate,
          companyName: companyName ?? undefined,
        },
        create: {
          userId,
          tradeId: g.tradeId,
          brokerId,
          ticker,
          companyName: companyName ?? ticker,
          quantity: g.quantity,
          proceedsKes: g.proceedsKes,
          costBasisKes: g.costBasisKes,
          realizedGainKes: g.realizedGainKes,
          tradeDate: g.tradeDate,
        },
      });
    }
  }

  async listTrades(userId: string, params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const where = { userId };

    const [data, total] = await Promise.all([
      this.prisma.trade.findMany({
        where,
        include: { broker: true },
        orderBy: { tradeDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.trade.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createTrade(userId: string, dto: CreateTradeDto) {
    const broker = await this.findBrokerOrThrow(dto.brokerId);
    const ticker = dto.ticker.toUpperCase().trim();
    const feesKes = dto.feesKes ?? (dto.quantity * dto.pricePerShare * broker.feePercent) / 100;
    const totalKes = this.computeTotal(dto.side, dto.quantity, dto.pricePerShare, feesKes);

    const trade = await this.prisma.trade.create({
      data: {
        userId,
        brokerId: dto.brokerId,
        ticker,
        companyName: dto.companyName,
        side: dto.side,
        quantity: dto.quantity,
        pricePerShare: dto.pricePerShare,
        feesKes,
        totalKes,
        tradeDate: new Date(dto.tradeDate),
        notes: dto.notes,
        source: 'MANUAL',
      },
    });

    await this.syncHolding(userId, dto.brokerId, ticker, dto.companyName);
    return trade;
  }

  async updateTrade(userId: string, tradeId: string, dto: UpdateTradeDto) {
    const existing = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Trade not found');

    const brokerId = dto.brokerId ?? existing.brokerId;
    const broker = await this.findBrokerOrThrow(brokerId);
    const ticker = (dto.ticker ?? existing.ticker).toUpperCase().trim();
    const side = dto.side ?? existing.side;
    const quantity = dto.quantity ?? existing.quantity;
    const pricePerShare = dto.pricePerShare ?? existing.pricePerShare;
    const feesKes = dto.feesKes ?? (dto.pricePerShare || dto.quantity ? (quantity * pricePerShare * broker.feePercent) / 100 : existing.feesKes);
    const totalKes = this.computeTotal(side, quantity, pricePerShare, feesKes);

    const updated = await this.prisma.trade.update({
      where: { id: tradeId },
      data: {
        brokerId,
        ticker,
        companyName: dto.companyName ?? existing.companyName,
        side,
        quantity,
        pricePerShare,
        feesKes,
        totalKes,
        tradeDate: dto.tradeDate ? new Date(dto.tradeDate) : existing.tradeDate,
        notes: dto.notes ?? existing.notes,
      },
    });

    // Resync holdings for both the old and new (broker, ticker) pair in case they changed.
    await this.syncHolding(userId, existing.brokerId, existing.ticker, existing.companyName);
    if (brokerId !== existing.brokerId || ticker !== existing.ticker) {
      await this.syncHolding(userId, brokerId, ticker, updated.companyName);
    }

    return updated;
  }

  async deleteTrade(userId: string, tradeId: string) {
    const existing = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Trade not found');

    // RealizedGain.tradeId is ON DELETE RESTRICT, so a SELL's gain row must
    // go first or the trade delete below would be rejected.
    await this.prisma.realizedGain.deleteMany({ where: { tradeId } });
    await this.prisma.trade.delete({ where: { id: tradeId } });
    await this.syncHolding(userId, existing.brokerId, existing.ticker, existing.companyName);
    return { success: true };
  }

  private async getLatestPriceMap(): Promise<Map<string, number>> {
    const rows = (await this.marketData.getLatestPrices()) as LatestStockPriceRow[];
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r?.ticker && typeof r.price === 'number') {
        map.set(r.ticker.toUpperCase(), r.price);
      }
    }
    return map;
  }

  /** Last recorded market price at or before `at` - the price a holding is assumed to have been bought at when it is imported. */
  private async priceAtOrBefore(ticker: string, at: Date): Promise<{ price: number; at: Date } | null> {
    const row = await this.prisma.stockPrice.findFirst({
      where: { ticker, price: { gt: 0 }, timestamp: { lte: at } },
      orderBy: { timestamp: 'desc' },
      select: { price: true, timestamp: true },
    });
    return row ? { price: row.price, at: row.timestamp } : null;
  }

  /** Lets the user replace an estimated (or any) cost per share with the real one. */
  async setHoldingCost(userId: string, holdingId: string, avgCost: number) {
    const holding = await this.prisma.holding.findUnique({ where: { id: holdingId } });
    if (!holding || holding.userId !== userId) throw new NotFoundException('Holding not found');
    const updated = await this.prisma.holding.update({
      where: { id: holdingId },
      data: { avgCost, costSource: 'MANUAL', costDate: new Date() },
    });
    return { id: updated.id, ticker: updated.ticker, avgCost: updated.avgCost, costSource: updated.costSource, costDate: updated.costDate };
  }

  async getPortfolio(userId: string) {
    const holdings = await this.prisma.holding.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { broker: true },
      orderBy: { ticker: 'asc' },
    });

    const priceMap = await this.getLatestPriceMap();

    const positions = holdings.map((h) => {
      const costBasisKes = h.avgCost ? h.avgCost * h.quantity : null;
      const currentPrice = priceMap.get(h.ticker.toUpperCase()) ?? null;
      const marketValueKes = currentPrice != null ? h.quantity * currentPrice : null;
      const unrealizedGainKes =
        marketValueKes != null && costBasisKes != null ? marketValueKes - costBasisKes : null;

      return {
        id: h.id,
        ticker: h.ticker,
        companyName: h.companyName,
        broker: { id: h.broker.id, name: h.broker.name },
        quantity: h.quantity,
        avgCost: h.avgCost,
        costSource: h.costSource,
        costDate: h.costDate,
        costBasisKes,
        currentPrice,
        marketValueKes,
        unrealizedGainKes,
      };
    });

    const totalCostBasisKes = positions.reduce((sum, p) => sum + (p.costBasisKes ?? 0), 0);
    const totalMarketValueKes = positions.reduce((sum, p) => sum + (p.marketValueKes ?? 0), 0);
    const totalUnrealizedGainKes = positions.reduce((sum, p) => sum + (p.unrealizedGainKes ?? 0), 0);

    const byTicker = new Map<
      string,
      { ticker: string; companyName: string | null; quantity: number; costBasisKes: number; hasCostBasis: boolean; costEstimated: boolean; currentPrice: number | null }
    >();
    for (const p of positions) {
      const existing = byTicker.get(p.ticker);
      if (existing) {
        existing.quantity += p.quantity;
        existing.costBasisKes += p.costBasisKes ?? 0;
        existing.hasCostBasis = existing.hasCostBasis && p.costBasisKes != null;
        existing.costEstimated = existing.costEstimated || p.costSource === 'IMPORT_PRICE';
      } else {
        byTicker.set(p.ticker, {
          ticker: p.ticker,
          companyName: p.companyName,
          quantity: p.quantity,
          costBasisKes: p.costBasisKes ?? 0,
          hasCostBasis: p.costBasisKes != null,
          costEstimated: p.costSource === 'IMPORT_PRICE',
          currentPrice: p.currentPrice,
        });
      }
    }

    const consolidated = Array.from(byTicker.values()).map((c) => {
      const costBasisKes = c.hasCostBasis ? c.costBasisKes : null;
      const avgCost = costBasisKes != null && c.quantity > 0 ? costBasisKes / c.quantity : null;
      const marketValueKes = c.currentPrice != null ? c.quantity * c.currentPrice : null;
      const unrealizedGainKes =
        marketValueKes != null && costBasisKes != null ? marketValueKes - costBasisKes : null;

      return {
        ticker: c.ticker,
        companyName: c.companyName,
        quantity: c.quantity,
        avgCost,
        costBasisKes,
        costEstimated: c.costEstimated,
        currentPrice: c.currentPrice,
        marketValueKes,
        unrealizedGainKes,
      };
    });

    return {
      positions,
      consolidated,
      totalCostBasisKes,
      totalMarketValueKes,
      totalUnrealizedGainKes,
    };
  }

  async getRealizedGainsSummary(userId: string, year?: number) {
    const where: {
      userId: string;
      tradeDate?: { gte: Date; lt: Date };
    } = { userId };
    if (year) {
      where.tradeDate = { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
    }

    const trades = await this.prisma.realizedGain.findMany({
      where,
      orderBy: { tradeDate: 'desc' },
    });

    const totalRealizedGainKes = trades.reduce((sum, t) => sum + t.realizedGainKes, 0);

    const byTickerMap = new Map<
      string,
      { ticker: string; realizedGainKes: number; proceedsKes: number; costBasisKes: number; tradeCount: number }
    >();
    for (const t of trades) {
      const existing = byTickerMap.get(t.ticker);
      if (existing) {
        existing.realizedGainKes += t.realizedGainKes;
        existing.proceedsKes += t.proceedsKes;
        existing.costBasisKes += t.costBasisKes;
        existing.tradeCount += 1;
      } else {
        byTickerMap.set(t.ticker, {
          ticker: t.ticker,
          realizedGainKes: t.realizedGainKes,
          proceedsKes: t.proceedsKes,
          costBasisKes: t.costBasisKes,
          tradeCount: 1,
        });
      }
    }

    return {
      totalRealizedGainKes,
      byTicker: Array.from(byTickerMap.values()).sort((a, b) => b.realizedGainKes - a.realizedGainKes),
      trades,
    };
  }

  listRealizedGains(userId: string) {
    return this.prisma.realizedGain.findMany({
      where: { userId },
      include: { broker: true },
      orderBy: { tradeDate: 'desc' },
    });
  }

  async importStatement(userId: string, filename: string, fileBuffer: Buffer) {
    let text: string;
    try {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(fileBuffer);
      text = result.text as string;
    } catch (err) {
      await this.prisma.statementImport.create({
        data: { userId, filename, status: 'failed', error: 'Could not read PDF' },
      });
      throw new BadRequestException('Could not read the uploaded PDF');
    }

    const parsed = parseCdscStatement(text);
    if (parsed.holdings.length === 0) {
      await this.prisma.statementImport.create({
        data: {
          userId,
          filename,
          accountNo: parsed.accountNo,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          status: 'failed',
          error: 'No holdings found in statement',
        },
      });
      throw new BadRequestException('No holdings could be found in this statement');
    }

    const brokers = await this.prisma.broker.findMany({ where: { cdaCode: { not: null } } });
    const brokerByCda = new Map(brokers.map((b) => [b.cdaCode, b]));
    let fallbackBroker = await this.prisma.broker.findUnique({ where: { name: 'Other / Not listed' } });

    let holdingsRead = 0;
    for (const h of parsed.holdings) {
      const broker = brokerByCda.get(h.cdaCode) ?? fallbackBroker;
      if (!broker) continue;

      const ticker = h.ticker.toUpperCase().trim();
      const existing = await this.prisma.holding.findUnique({
        where: { userId_brokerId_ticker: { userId, brokerId: broker.id, ticker } },
      });
      // A holding with no cost yet is assumed bought at today's price. One that
      // already has a cost (typed by the user, or from trades) is left alone.
      const estimate = existing?.avgCost == null ? await this.priceAtOrBefore(ticker, new Date()) : null;
      const costFields = estimate ? { avgCost: estimate.price, costSource: 'IMPORT_PRICE', costDate: estimate.at } : {};
      await this.prisma.holding.upsert({
        where: { userId_brokerId_ticker: { userId, brokerId: broker.id, ticker } },
        update: {
          quantity: h.closingBalance,
          companyName: h.companyName,
          ...costFields,
        },
        create: {
          userId,
          brokerId: broker.id,
          ticker,
          companyName: h.companyName,
          quantity: h.closingBalance,
          avgCost: null,
          ...costFields,
        },
      });
      holdingsRead += 1;
    }

    // Dividend-line parsing is best-effort - the real CDSC line format is
    // unconfirmed (see statement-parser.ts). Never let it fail the import.
    let dividendsRead = 0;
    for (const d of parsed.dividends ?? []) {
      try {
        const broker = brokerByCda.get(d.cdaCode) ?? fallbackBroker;
        if (!broker || !d.paymentDate) continue;

        const ticker = d.ticker.toUpperCase().trim();
        const existingDividend = await this.prisma.dividend.findFirst({
          where: {
            userId,
            brokerId: broker.id,
            ticker,
            paymentDate: d.paymentDate,
            amountKes: d.amountKes,
          },
        });
        if (existingDividend) continue;

        await this.prisma.dividend.create({
          data: {
            userId,
            brokerId: broker.id,
            ticker,
            amountKes: d.amountKes,
            paymentDate: d.paymentDate,
            source: 'CDSC_IMPORT',
          },
        });
        dividendsRead += 1;
      } catch (err) {
        this.logger.warn(`Skipped a dividend line during import: ${(err as Error).message}`);
      }
    }

    const record = await this.prisma.statementImport.create({
      data: {
        userId,
        filename,
        accountNo: parsed.accountNo,
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        holdingsRead,
        status: 'completed',
      },
    });

    this.logger.log(
      `Imported statement for user ${userId}: ${holdingsRead} holdings, ${dividendsRead} dividends`,
    );
    return record;
  }

  listStatementImports(userId: string) {
    return this.prisma.statementImport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDividend(userId: string, dto: CreateDividendDto) {
    await this.findBrokerOrThrow(dto.brokerId);
    return this.prisma.dividend.create({
      data: {
        userId,
        brokerId: dto.brokerId,
        ticker: dto.ticker.toUpperCase().trim(),
        companyName: dto.companyName,
        amountKes: dto.amountKes,
        paymentDate: new Date(dto.paymentDate),
        notes: dto.notes,
        source: 'MANUAL',
      },
    });
  }

  listDividends(userId: string) {
    return this.prisma.dividend.findMany({
      where: { userId },
      include: { broker: true },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async updateDividend(userId: string, dividendId: string, dto: UpdateDividendDto) {
    const existing = await this.prisma.dividend.findUnique({ where: { id: dividendId } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Dividend not found');

    if (dto.brokerId) await this.findBrokerOrThrow(dto.brokerId);

    return this.prisma.dividend.update({
      where: { id: dividendId },
      data: {
        brokerId: dto.brokerId ?? existing.brokerId,
        ticker: dto.ticker ? dto.ticker.toUpperCase().trim() : existing.ticker,
        companyName: dto.companyName ?? existing.companyName,
        amountKes: dto.amountKes ?? existing.amountKes,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : existing.paymentDate,
        notes: dto.notes ?? existing.notes,
      },
    });
  }

  async deleteDividend(userId: string, dividendId: string) {
    const existing = await this.prisma.dividend.findUnique({ where: { id: dividendId } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Dividend not found');

    await this.prisma.dividend.delete({ where: { id: dividendId } });
    return { success: true };
  }

  async getYieldOnCost(userId: string) {
    const [portfolio, sinceDate] = await Promise.all([
      this.getPortfolio(userId),
      Promise.resolve(new Date(Date.now() - YIELD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)),
    ]);

    const dividends = await this.prisma.dividend.findMany({
      where: { userId, paymentDate: { gte: sinceDate } },
    });

    const dividendsByTicker = new Map<string, number>();
    for (const d of dividends) {
      dividendsByTicker.set(d.ticker, (dividendsByTicker.get(d.ticker) ?? 0) + d.amountKes);
    }

    return portfolio.consolidated
      .filter((c) => c.costBasisKes != null && c.costBasisKes > 0)
      .map((c) => {
        const annualDividendsKes = dividendsByTicker.get(c.ticker) ?? 0;
        const costBasisKes = c.costBasisKes as number;
        return {
          ticker: c.ticker,
          companyName: c.companyName,
          annualDividendsKes,
          costBasisKes,
          yieldOnCostPct: (annualDividendsKes / costBasisKes) * 100,
        };
      })
      .sort((a, b) => b.yieldOnCostPct - a.yieldOnCostPct);
  }
}

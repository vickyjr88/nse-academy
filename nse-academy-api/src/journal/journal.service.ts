import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { UpdateTradeDto } from './dto/update-trade.dto';
import { BROKER_SEED } from './brokers.seed';
import { parseCdscStatement } from './statement-parser';

@Injectable()
export class JournalService implements OnModuleInit {
  private readonly logger = new Logger(JournalService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedBrokers();
  }

  private async seedBrokers() {
    for (const broker of BROKER_SEED) {
      await this.prisma.broker.upsert({
        where: { name: broker.name },
        update: {
          cdaCode: broker.cdaCode,
          feePercent: broker.feePercent,
          cdsRequired: broker.cdsRequired,
        },
        create: broker,
      });
    }
  }

  listBrokers() {
    return this.prisma.broker.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  private async findBrokerOrThrow(brokerId: string) {
    const broker = await this.prisma.broker.findUnique({ where: { id: brokerId } });
    if (!broker) throw new NotFoundException('Broker not found');
    return broker;
  }

  private computeTotal(side: string, quantity: number, pricePerShare: number, feesKes: number) {
    const gross = quantity * pricePerShare;
    return side === 'BUY' ? gross + feesKes : gross - feesKes;
  }

  private async syncHolding(userId: string, brokerId: string, ticker: string, companyName: string | null | undefined) {
    const trades = await this.prisma.trade.findMany({
      where: { userId, brokerId, ticker },
    });

    let quantity = 0;
    let totalCost = 0;
    let costedQuantity = 0;

    for (const t of trades) {
      if (t.side === 'BUY') {
        quantity += t.quantity;
        totalCost += t.quantity * t.pricePerShare + t.feesKes;
        costedQuantity += t.quantity;
      } else {
        quantity -= t.quantity;
        costedQuantity -= t.quantity;
      }
    }

    const avgCost = costedQuantity > 0 ? totalCost / costedQuantity : null;

    await this.prisma.holding.upsert({
      where: { userId_brokerId_ticker: { userId, brokerId, ticker } },
      update: { quantity, avgCost, companyName: companyName ?? undefined },
      create: {
        userId,
        brokerId,
        ticker,
        companyName: companyName ?? ticker,
        quantity,
        avgCost,
      },
    });
  }

  async listTrades(userId: string) {
    return this.prisma.trade.findMany({
      where: { userId },
      include: { broker: true },
      orderBy: { tradeDate: 'desc' },
    });
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

    await this.prisma.trade.delete({ where: { id: tradeId } });
    await this.syncHolding(userId, existing.brokerId, existing.ticker, existing.companyName);
    return { success: true };
  }

  async getPortfolio(userId: string) {
    const holdings = await this.prisma.holding.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { broker: true },
      orderBy: { ticker: 'asc' },
    });

    const positions = holdings.map((h) => ({
      ticker: h.ticker,
      companyName: h.companyName,
      broker: { id: h.broker.id, name: h.broker.name },
      quantity: h.quantity,
      avgCost: h.avgCost,
      costBasisKes: h.avgCost ? h.avgCost * h.quantity : null,
    }));

    const totalCostBasisKes = positions.reduce((sum, p) => sum + (p.costBasisKes ?? 0), 0);

    return { positions, totalCostBasisKes };
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
      await this.prisma.holding.upsert({
        where: { userId_brokerId_ticker: { userId, brokerId: broker.id, ticker } },
        update: {
          quantity: h.closingBalance,
          companyName: h.companyName,
        },
        create: {
          userId,
          brokerId: broker.id,
          ticker,
          companyName: h.companyName,
          quantity: h.closingBalance,
          avgCost: null,
        },
      });
      holdingsRead += 1;
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

    this.logger.log(`Imported statement for user ${userId}: ${holdingsRead} holdings`);
    return record;
  }

  listStatementImports(userId: string) {
    return this.prisma.statementImport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

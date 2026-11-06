import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { UpdateTradeDto } from '../journal/dto/update-trade.dto';
import { CreateHoldingDto, UpdateHoldingDto } from './admin-holdings.dto';

/** What the audit trail records for a holding: the facts that matter, not the whole row. */
const snapshot = (h: { ticker: string; quantity: number; avgCost: number | null; costSource: string | null; brokerId: string }) => ({
  ticker: h.ticker,
  brokerId: h.brokerId,
  quantity: h.quantity,
  avgCost: h.avgCost,
  costSource: h.costSource,
});

export interface Change {
  result: unknown;
  /** Attached to the audit entry so the log shows exactly what changed. */
  audit: { before?: unknown; after?: unknown };
}

/**
 * Admin edits to a member's portfolio, for support. A holding built from trades is recomputed from those trades every
 * time one changes, so editing its quantity or cost directly would silently be undone: those are refused, and the admin
 * is pointed at the trades. Holdings that came from a statement import or were typed in can be edited freely.
 */
@Injectable()
export class AdminHoldingsService {
  constructor(
    private prisma: PrismaService,
    private journal: JournalService,
  ) {}

  private async ownedHolding(userId: string, holdingId: string) {
    const holding = await this.prisma.holding.findUnique({ where: { id: holdingId } });
    if (!holding || holding.userId !== userId) throw new NotFoundException('Holding not found');
    return holding;
  }

  private async tradeCount(h: { userId: string; brokerId: string; ticker: string }) {
    return this.prisma.trade.count({ where: { userId: h.userId, brokerId: h.brokerId, ticker: h.ticker } });
  }

  async update(userId: string, holdingId: string, dto: UpdateHoldingDto): Promise<Change> {
    const holding = await this.ownedHolding(userId, holdingId);
    const trades = await this.tradeCount(holding);
    const touchesFigures = dto.quantity !== undefined || dto.avgCost !== undefined;
    if (touchesFigures && trades > 0) {
      throw new ConflictException(`This holding is calculated from the member's ${trades} trade${trades === 1 ? '' : 's'}. Edit or delete those trades instead; a direct edit would be overwritten the next time a trade changes.`);
    }
    if (dto.quantity === undefined && dto.avgCost === undefined && dto.companyName === undefined) throw new BadRequestException('Nothing to change');

    const data: Record<string, unknown> = {};
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.avgCost !== undefined) {
      data.avgCost = dto.avgCost;
      data.costSource = dto.avgCost === null ? null : 'ADMIN';
      data.costDate = dto.avgCost === null ? null : new Date();
    }
    if (dto.companyName !== undefined) data.companyName = dto.companyName.trim() || null;

    const updated = await this.prisma.holding.update({ where: { id: holdingId }, data });
    return { result: updated, audit: { before: snapshot(holding), after: snapshot(updated) } };
  }

  async create(userId: string, dto: CreateHoldingDto): Promise<Change> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const broker = await this.prisma.broker.findUnique({ where: { id: dto.brokerId } });
    if (!broker) throw new NotFoundException('Broker not found');
    const ticker = dto.ticker.toUpperCase().trim();
    const existing = await this.prisma.holding.findUnique({ where: { userId_brokerId_ticker: { userId, brokerId: dto.brokerId, ticker } } });
    if (existing) throw new ConflictException(`The member already holds ${ticker} at ${broker.name}. Edit that holding instead.`);

    const created = await this.prisma.holding.create({
      data: {
        userId,
        brokerId: dto.brokerId,
        ticker,
        companyName: dto.companyName?.trim() || ticker,
        quantity: dto.quantity,
        avgCost: dto.avgCost ?? null,
        costSource: dto.avgCost ? 'ADMIN' : null,
        costDate: dto.avgCost ? new Date() : null,
      },
    });
    return { result: created, audit: { after: snapshot(created) } };
  }

  async remove(userId: string, holdingId: string): Promise<Change> {
    const holding = await this.ownedHolding(userId, holdingId);
    const trades = await this.tradeCount(holding);
    if (trades > 0) {
      throw new ConflictException(`This holding is calculated from the member's ${trades} trade${trades === 1 ? '' : 's'}. Delete those trades to remove it.`);
    }
    await this.prisma.holding.delete({ where: { id: holdingId } });
    return { result: { deleted: true }, audit: { before: snapshot(holding) } };
  }

  async updateTrade(userId: string, tradeId: string, dto: UpdateTradeDto): Promise<Change> {
    const before = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    const result = await this.journal.updateTrade(userId, tradeId, dto);
    return { result, audit: { before: before && tradeFacts(before), after: tradeFacts(result as never) } };
  }

  async deleteTrade(userId: string, tradeId: string): Promise<Change> {
    const before = await this.prisma.trade.findUnique({ where: { id: tradeId } });
    const result = await this.journal.deleteTrade(userId, tradeId);
    return { result, audit: { before: before && tradeFacts(before) } };
  }
}

const tradeFacts = (t: { ticker: string; side: string; quantity: number; pricePerShare: number; tradeDate: Date | string }) => ({
  ticker: t.ticker,
  side: t.side,
  quantity: t.quantity,
  pricePerShare: t.pricePerShare,
  tradeDate: t.tradeDate,
});

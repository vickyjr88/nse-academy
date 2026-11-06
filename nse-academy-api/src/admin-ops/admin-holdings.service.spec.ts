import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminHoldingsService } from './admin-holdings.service';

const holding = (over: Record<string, unknown> = {}) => ({ id: 'h1', userId: 'u1', brokerId: 'b1', ticker: 'NSE', companyName: 'NSE', quantity: 5000, avgCost: 26.05, costSource: 'IMPORT_PRICE', costDate: new Date(), ...over });

function make(opts: { trades?: number; holding?: Record<string, unknown> | null } = {}) {
  const prisma = {
    holding: {
      findUnique: jest.fn(async ({ where }: any) => (where.userId_brokerId_ticker ? null : opts.holding === null ? null : holding(opts.holding ?? {}))),
      update: jest.fn(async ({ data }: any) => ({ ...holding(opts.holding ?? {}), ...data })),
      create: jest.fn(async ({ data }: any) => ({ id: 'new', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    trade: { count: jest.fn().mockResolvedValue(opts.trades ?? 0), findUnique: jest.fn().mockResolvedValue({ ticker: 'NSE', side: 'BUY', quantity: 10, pricePerShare: 25, tradeDate: new Date('2026-08-01') }) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    broker: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', name: 'Equity' }) },
  };
  const journal = {
    updateTrade: jest.fn().mockResolvedValue({ ticker: 'NSE', side: 'BUY', quantity: 20, pricePerShare: 25, tradeDate: new Date('2026-08-01') }),
    deleteTrade: jest.fn().mockResolvedValue({ success: true }),
  };
  return { svc: new AdminHoldingsService(prisma as never, journal as never), prisma, journal };
}

describe('AdminHoldingsService.update', () => {
  it('changes the shares and cost of an imported holding, marks the cost as admin-set, and returns before and after for the audit trail', async () => {
    const { svc, prisma } = make();
    const out = await svc.update('u1', 'h1', { quantity: 4000, avgCost: 28.4 });
    const data = prisma.holding.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ quantity: 4000, avgCost: 28.4, costSource: 'ADMIN' });
    expect(data.costDate).toBeInstanceOf(Date);
    expect(out.audit).toEqual({
      before: { ticker: 'NSE', brokerId: 'b1', quantity: 5000, avgCost: 26.05, costSource: 'IMPORT_PRICE' },
      after: { ticker: 'NSE', brokerId: 'b1', quantity: 4000, avgCost: 28.4, costSource: 'ADMIN' },
    });
  });

  it('clearing the cost also clears where it came from', async () => {
    const { svc, prisma } = make();
    await svc.update('u1', 'h1', { avgCost: null });
    expect(prisma.holding.update.mock.calls[0][0].data).toMatchObject({ avgCost: null, costSource: null, costDate: null });
  });

  it('refuses to edit shares or cost on a holding that is calculated from trades, and says what to do', async () => {
    const { svc, prisma } = make({ trades: 3 });
    await expect(svc.update('u1', 'h1', { quantity: 1 })).rejects.toThrow(/calculated from the member's 3 trades/);
    await expect(svc.update('u1', 'h1', { avgCost: 5 })).rejects.toThrow(ConflictException);
    expect(prisma.holding.update).not.toHaveBeenCalled();
  });

  it('still lets the company name of a trade-derived holding be corrected', async () => {
    const { svc, prisma } = make({ trades: 3 });
    await svc.update('u1', 'h1', { companyName: ' Nairobi Securities Exchange ' });
    expect(prisma.holding.update.mock.calls[0][0].data).toEqual({ companyName: 'Nairobi Securities Exchange' });
  });

  it("will not touch another member's holding, and rejects an empty edit", async () => {
    const { svc } = make({ holding: { userId: 'someone-else' } });
    await expect(svc.update('u1', 'h1', { quantity: 1 })).rejects.toThrow(NotFoundException);
    await expect(make({ holding: null }).svc.update('u1', 'h1', { quantity: 1 })).rejects.toThrow(NotFoundException);
    await expect(make().svc.update('u1', 'h1', {})).rejects.toThrow(BadRequestException);
  });
});

describe('AdminHoldingsService.create', () => {
  it('adds a holding with an upper-cased ticker, and records an admin-entered cost', async () => {
    const { svc, prisma } = make();
    const out = await svc.create('u1', { brokerId: 'b1', ticker: ' scom ', quantity: 100, avgCost: 30 });
    expect(prisma.holding.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', brokerId: 'b1', ticker: 'SCOM', companyName: 'SCOM', quantity: 100, avgCost: 30, costSource: 'ADMIN' });
    expect(out.audit).toMatchObject({ after: { ticker: 'SCOM', quantity: 100 } });
  });
  it('leaves the cost empty when none is given', async () => {
    const { svc, prisma } = make();
    await svc.create('u1', { brokerId: 'b1', ticker: 'KCB', quantity: 5 });
    expect(prisma.holding.create.mock.calls[0][0].data).toMatchObject({ avgCost: null, costSource: null });
  });
  it('refuses a duplicate, an unknown broker and an unknown member', async () => {
    const dup = make();
    dup.prisma.holding.findUnique.mockResolvedValue(holding());
    await expect(dup.svc.create('u1', { brokerId: 'b1', ticker: 'NSE', quantity: 1 })).rejects.toThrow(/already holds NSE at Equity/);
    const noBroker = make();
    noBroker.prisma.broker.findUnique.mockResolvedValue(null);
    await expect(noBroker.svc.create('u1', { brokerId: 'zz', ticker: 'NSE', quantity: 1 })).rejects.toThrow(NotFoundException);
    const noUser = make();
    noUser.prisma.user.findUnique.mockResolvedValue(null);
    await expect(noUser.svc.create('nope', { brokerId: 'b1', ticker: 'NSE', quantity: 1 })).rejects.toThrow(NotFoundException);
  });
});

describe('AdminHoldingsService.remove', () => {
  it('deletes an imported holding and records what it was', async () => {
    const { svc, prisma } = make();
    const out = await svc.remove('u1', 'h1');
    expect(prisma.holding.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
    expect(out.audit).toMatchObject({ before: { ticker: 'NSE', quantity: 5000 } });
  });
  it('refuses to delete a holding that trades still define', async () => {
    const { svc, prisma } = make({ trades: 1 });
    await expect(svc.remove('u1', 'h1')).rejects.toThrow(/Delete those trades/);
    expect(prisma.holding.delete).not.toHaveBeenCalled();
  });
});

describe('AdminHoldingsService trades', () => {
  it('edits a trade through the journal, so holdings and realized gains are recomputed, and reports before and after', async () => {
    const { svc, journal } = make();
    const out = await svc.updateTrade('u1', 't1', { quantity: 20 });
    expect(journal.updateTrade).toHaveBeenCalledWith('u1', 't1', { quantity: 20 });
    expect(out.audit).toMatchObject({ before: { quantity: 10 }, after: { quantity: 20 } });
  });
  it('deletes a trade through the journal and records what it was', async () => {
    const { svc, journal } = make();
    const out = await svc.deleteTrade('u1', 't1');
    expect(journal.deleteTrade).toHaveBeenCalledWith('u1', 't1');
    expect(out.audit).toMatchObject({ before: { ticker: 'NSE', quantity: 10 } });
  });
});

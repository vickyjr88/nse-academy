import { NotFoundException } from '@nestjs/common';
import { JournalService } from './journal.service';

jest.mock('pdf-parse', () => async () => ({ text: 'statement' }), { virtual: true });
jest.mock('./statement-parser', () => ({
  parseCdscStatement: jest.fn(() => ({
    accountNo: '1',
    periodStart: null,
    periodEnd: null,
    dividends: [],
    holdings: [
      { cdaCode: 'EQBC', ticker: 'nse', companyName: 'NSE PLC', closingBalance: 5000 },
      { cdaCode: 'EQBC', ticker: 'SCOM', companyName: 'Safaricom', closingBalance: 100 },
      { cdaCode: 'EQBC', ticker: 'KCB', companyName: 'KCB Group', closingBalance: 500 },
    ],
  })),
}));

const T0 = new Date('2026-11-05T09:00:00Z');

function make(opts: { existing?: Record<string, { avgCost: number | null; costSource?: string | null }>; prices?: Record<string, number> } = {}) {
  const upserts: any[] = [];
  const prisma = {
    broker: {
      findMany: jest.fn().mockResolvedValue([{ id: 'b1', cdaCode: 'EQBC' }]),
      findUnique: jest.fn().mockResolvedValue({ id: 'b-other' }),
    },
    holding: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id) return Promise.resolve(holdingRow);
        return Promise.resolve(opts.existing?.[where.userId_brokerId_ticker.ticker] ?? null);
      }),
      upsert: jest.fn((args: any) => {
        upserts.push(args);
        return Promise.resolve({});
      }),
      update: jest.fn(({ data }: any) => Promise.resolve({ ...holdingRow, ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    stockPrice: {
      findFirst: jest.fn(({ where }: any) => {
        const p = opts.prices?.[where.ticker];
        return Promise.resolve(p ? { price: p, timestamp: T0 } : null);
      }),
    },
    statementImport: { create: jest.fn().mockResolvedValue({ id: 's1' }) },
    dividend: { findFirst: jest.fn(), create: jest.fn() },
  };
  const marketData = { getLatestPrices: jest.fn().mockResolvedValue([]) };
  const holdingRow = { id: 'h1', userId: 'u1', ticker: 'NSE', avgCost: null as number | null, costSource: null as string | null, costDate: null };
  return { service: new JournalService(prisma as never, marketData as never), prisma, upserts, marketData };
}

describe('JournalService.importStatement - cost basis', () => {
  it('gives a newly imported holding the latest market price as its estimated cost, marked IMPORT_PRICE', async () => {
    const { service, upserts } = make({ prices: { NSE: 26.05, SCOM: 36.6, KCB: 93.75 } });
    await service.importStatement('u1', 'stmt.pdf', Buffer.from('x'));
    const nse = upserts.find((u) => u.create.ticker === 'NSE');
    expect(nse.create).toMatchObject({ avgCost: 26.05, costSource: 'IMPORT_PRICE', costDate: T0 });
    expect(nse.update).toMatchObject({ avgCost: 26.05, costSource: 'IMPORT_PRICE', quantity: 5000 });
  });

  it('leaves the cost empty when no price has ever been recorded for the ticker', async () => {
    const { service, upserts } = make({ prices: { NSE: 26.05 } });
    await service.importStatement('u1', 'stmt.pdf', Buffer.from('x'));
    const kcb = upserts.find((u) => u.create.ticker === 'KCB');
    expect(kcb.create.avgCost).toBeNull();
    expect(kcb.update).not.toHaveProperty('avgCost');
  });

  it('never overwrites a cost the user already set (or that came from trades) when the statement is re-imported', async () => {
    const { service, upserts, prisma } = make({ existing: { NSE: { avgCost: 28, costSource: 'MANUAL' } }, prices: { NSE: 33.65, SCOM: 35, KCB: 90 } });
    await service.importStatement('u1', 'stmt.pdf', Buffer.from('x'));
    const nse = upserts.find((u) => u.create.ticker === 'NSE');
    expect(nse.update).not.toHaveProperty('avgCost');
    expect(nse.update).not.toHaveProperty('costSource');
    expect(nse.update.quantity).toBe(5000);
    // ...and it does not even look the price up for it
    expect(prisma.stockPrice.findFirst.mock.calls.map((c: any) => c[0].where.ticker)).not.toContain('NSE');
  });

  it('fills in a missing cost on a holding that was imported before this feature existed', async () => {
    const { service, upserts } = make({ existing: { SCOM: { avgCost: null } }, prices: { NSE: 1, SCOM: 36.6, KCB: 1 } });
    await service.importStatement('u1', 'stmt.pdf', Buffer.from('x'));
    expect(upserts.find((u) => u.create.ticker === 'SCOM').update).toMatchObject({ avgCost: 36.6, costSource: 'IMPORT_PRICE' });
  });
});

describe('JournalService.setHoldingCost', () => {
  it('stores the cost as MANUAL so it is no longer treated as an estimate', async () => {
    const { service, prisma } = make();
    const out = await service.setHoldingCost('u1', 'h1', 28.4);
    expect(prisma.holding.update.mock.calls[0][0].data).toMatchObject({ avgCost: 28.4, costSource: 'MANUAL' });
    expect(out).toMatchObject({ id: 'h1', avgCost: 28.4, costSource: 'MANUAL' });
  });

  it("will not touch another user's holding", async () => {
    const { service, prisma } = make();
    await expect(service.setHoldingCost('someone-else', 'h1', 10)).rejects.toThrow(NotFoundException);
    expect(prisma.holding.update).not.toHaveBeenCalled();
  });
});

describe('JournalService.getPortfolio - estimated costs', () => {
  it('exposes the holding id and cost provenance, and flags a consolidated line as estimated if any part is', async () => {
    const { service, prisma, marketData } = make();
    const mk = (id: string, costSource: string | null, avgCost: number | null) => ({
      id, ticker: 'KNRE', companyName: 'Kenya Re', quantity: 100, avgCost, costSource, costDate: T0, broker: { id: 'b' + id, name: 'B' + id },
    });
    prisma.holding.findMany.mockResolvedValue([mk('h1', 'IMPORT_PRICE', 3.86), mk('h2', 'MANUAL', 4)]);
    marketData.getLatestPrices.mockResolvedValue([{ ticker: 'KNRE', price: 4.16 }]);
    const p = await service.getPortfolio('u1');
    expect(p.positions.map((x) => [x.id, x.costSource])).toEqual([['h1', 'IMPORT_PRICE'], ['h2', 'MANUAL']]);
    expect(p.consolidated[0].costEstimated).toBe(true);
    expect(p.consolidated[0].avgCost).toBeCloseTo(3.93, 6);
    expect(p.totalUnrealizedGainKes).toBeCloseTo(100 * 4.16 * 2 - (386 + 400), 6);
  });
});

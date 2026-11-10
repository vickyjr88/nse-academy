import { BadRequestException } from '@nestjs/common';
import { AllocationService } from './allocation.service';

function make(opts: { holdings?: any[]; targets?: any[]; closes?: Record<string, number> } = {}) {
  const holdings = opts.holdings ?? [
    { ticker: 'SCOM', quantity: 2000, broker: { id: 'b1', name: 'A', feePercent: 1.5 } },
    { ticker: 'KCB', quantity: 100, broker: { id: 'b2', name: 'B', feePercent: 1 } },
    { ticker: 'EQTY', quantity: 50, broker: { id: 'b2', name: 'B', feePercent: 1 } },
  ];
  const closes = opts.closes ?? { SCOM: 30, KCB: 90, EQTY: 100 };
  const rows = Object.entries(closes).map(([ticker, price]) => ({ ticker, d: '2026-11-05', price }));
  const prisma = {
    holding: { findMany: jest.fn().mockResolvedValue(holdings) },
    $queryRaw: jest.fn().mockResolvedValue(rows),
    allocationTarget: {
      findMany: jest.fn().mockResolvedValue(opts.targets ?? []),
      deleteMany: jest.fn().mockReturnValue('del'),
      createMany: jest.fn().mockReturnValue('create'),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const facts = { sectorMap: jest.fn().mockResolvedValue({ SCOM: 'Telecommunications', KCB: 'Banking Sector', EQTY: 'Banking Sector' }) };
  return { svc: new AllocationService(prisma as never, facts as never), prisma };
}

describe('AllocationService', () => {
  it('prices holdings at the last close, weights them, and notes concentration', async () => {
    const { svc } = make();
    const o = await svc.overview('u1');
    expect(o.valueKes).toBe(60_000 + 9_000 + 5_000);
    expect(o.rows[0]).toMatchObject({ ticker: 'SCOM', sector: 'Telecommunications' });
    expect(o.notes.join(' ')).toMatch(/SCOM is 81% of your portfolio/);
    expect(o.sectors.map((s) => s.sector)).toEqual(['Telecommunications', 'Banking Sector']);
  });

  it('leaves out a holding with no recent price and says so', async () => {
    const { svc } = make({ closes: { SCOM: 30, KCB: 90 } });
    const o = await svc.overview('u1');
    expect(o.unpriced).toEqual(['EQTY']);
    expect(o.notes.join(' ')).toMatch(/EQTY has no recent price/);
  });

  it('refuses targets that do not add up and stores nothing', async () => {
    const { svc, prisma } = make();
    await expect(svc.setTargets('u1', [{ ticker: 'scom', weightPct: 50 }])).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replaces the targets in one transaction, upper-casing the codes', async () => {
    const { svc, prisma } = make();
    await svc.setTargets('u1', [{ ticker: ' scom ', weightPct: 60 }, { ticker: 'kcb', weightPct: 40 }]);
    expect(prisma.allocationTarget.createMany).toHaveBeenCalledWith({ data: [{ userId: 'u1', ticker: 'SCOM', weightPct: 60 }, { userId: 'u1', ticker: 'KCB', weightPct: 40 }] });
    expect(prisma.$transaction).toHaveBeenCalledWith(['del', 'create']);
  });

  it('clears the targets when given an empty list', async () => {
    const { svc, prisma } = make();
    await svc.setTargets('u1', []);
    expect(prisma.allocationTarget.createMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(['del']);
  });

  it('builds a plan from the saved targets, using the main broker\'s fee for a stock not yet held', async () => {
    const { svc } = make({ targets: [{ ticker: 'SCOM', weightPct: 40 }, { ticker: 'KCB', weightPct: 30 }, { ticker: 'EQTY', weightPct: 30 }] });
    const plan = await svc.plan('u1');
    expect(plan.baseKes).toBe(74_000);
    expect(plan.trades.some((t) => t.action === 'SELL' && t.ticker === 'SCOM')).toBe(true);
    expect(plan.targets).toHaveLength(3);
  });

  it('asks the member to set targets before planning', async () => {
    const { svc } = make();
    await expect(svc.plan('u1')).rejects.toThrow('Set your target weights first');
  });
});

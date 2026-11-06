import { NotFoundException } from '@nestjs/common';
import { AdminOpsService } from './admin-ops.service';

const d = (iso: string) => new Date(iso);

function make() {
  const prisma = {
    processedPayment: {
      findMany: jest.fn().mockResolvedValue([
        { reference: 'r2', userId: 'u2', plan: 'premium', months: 12, appliedAt: d('2026-11-05T09:00:00Z') },
        { reference: 'r1', userId: 'u1', plan: 'intermediary', months: 1, appliedAt: d('2026-11-04T09:00:00Z') },
      ]),
      count: jest.fn().mockResolvedValue(57),
      groupBy: jest.fn().mockResolvedValue([{ plan: 'premium', months: 12, _count: 2 }, { plan: 'intermediary', months: 1, _count: 3 }]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([{ id: 'u1', name: 'Ann', email: 'ann@x.com' }, { id: 'u2', name: 'Bob', email: 'bob@x.com' }]),
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Ann', email: 'ann@x.com', portfolioWatchEnabled: true }),
    },
    subscription: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'u1', tier: 'premium', status: 'active', currentPeriodEnd: new Date(Date.now() + 5 * 86_400_000 + 3_600_000), freeMonths: 0, user: { id: 'u1', name: 'Ann', email: 'ann@x.com' } }]),
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn().mockResolvedValue([{ tier: 'premium', status: 'active', _count: 2 }]),
    },
    marketReport: { findMany: jest.fn().mockResolvedValue([{ sessionDate: '2026-11-05', status: 'published', aiGenerated: true, aiModel: 'haiku', story: { headline: 'NSE Thu 5 Nov' }, publishedAt: d('2026-11-05T18:00:00Z'), createdAt: d('2026-11-05T18:00:00Z') }, { sessionDate: '2026-11-04', status: 'unpublished', aiGenerated: false, aiModel: null, story: null, publishedAt: null, createdAt: d('2026-11-04T18:00:00Z') }]) },
    holding: { findMany: jest.fn().mockResolvedValue([{ id: 'h1', ticker: 'NSE', brokerId: 'b1', broker: { name: 'Equity' }, quantity: 5000, avgCost: 26.05, costSource: 'IMPORT_PRICE', updatedAt: d('2026-08-24T00:00:00Z') }]) },
    trade: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([{ brokerId: 'b1', ticker: 'NSE', _count: 2 }]) },
    dividend: { findMany: jest.fn().mockResolvedValue([]) },
    statementImport: { findMany: jest.fn().mockResolvedValue([{ id: 'i1', filename: 's.pdf', status: 'failed', error: 'Could not read PDF', createdAt: d('2026-11-01T00:00:00Z') }]) },
    priceAlert: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { findMany: jest.fn().mockResolvedValue([]) },
    aiCall: { findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]) },
  };
  const jobs = { recent: jest.fn().mockResolvedValue([{ job: 'market-poll' }]) };
  const aiUsage = { summary: jest.fn().mockResolvedValue([{ feature: 'advisor' }]) };
  const health = { build: jest.fn().mockResolvedValue({ jobs: [{ name: 'a' }], feed: { attempts: 1 }, marketReport: { exists: true }, email: null, ai: { calls: 0 } }) };
  const facts = { latestSessionYmd: jest.fn().mockResolvedValue('2026-11-05') };
  return { svc: new AdminOpsService(prisma as never, jobs as never, aiUsage as never, health as never, facts as never), prisma, jobs, aiUsage, health, facts };
}

describe('AdminOpsService.payments', () => {
  it('lists the ledger with who paid and what each payment was worth, plus all-time revenue', async () => {
    const out = await make().svc.payments(1, 25);
    expect(out.data[0]).toMatchObject({ reference: 'r2', name: 'Bob', email: 'bob@x.com', plan: 'premium', months: 12, amountKes: 5100 });
    expect(out.data[1]).toMatchObject({ name: 'Ann', amountKes: 300 });
    expect(out.total).toBe(57);
    expect(out.totalPages).toBe(3);
    expect(out.totalRevenueKes).toBe(2 * 5100 + 3 * 300);
  });
  it('bounds paging so one request cannot read the whole table', async () => {
    const { svc, prisma } = make();
    await svc.payments(0, 100000);
    expect(prisma.processedPayment.findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 100 });
    await svc.payments(3, 10);
    expect(prisma.processedPayment.findMany.mock.calls[1][0]).toMatchObject({ skip: 20, take: 10 });
  });
});

describe('AdminOpsService.subscriptions', () => {
  it('returns members with days left and a tier/status summary', async () => {
    const out = await make().svc.subscriptions();
    expect(out.data[0]).toMatchObject({ name: 'Ann', tier: 'premium', daysLeft: 6 });
    expect(out.summary).toEqual([{ tier: 'premium', status: 'active', count: 2 }]);
  });
  it('narrows to renewals due: active, paid, ending between now and the cut-off', async () => {
    const { svc, prisma } = make();
    await svc.subscriptions({ expiringWithinDays: 7 });
    const where = prisma.subscription.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(where.tier).toEqual({ in: ['intermediary', 'premium'] });
    expect(where.currentPeriodEnd.lte.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });
});

describe('AdminOpsService.marketReports', () => {
  it('lists reports newest first with their headline, including unpublished ones', async () => {
    const out = await make().svc.marketReports();
    expect(out.map((r) => [r.sessionDate, r.status, r.headline])).toEqual([['2026-11-05', 'published', 'NSE Thu 5 Nov'], ['2026-11-04', 'unpublished', '']]);
  });
});

describe('AdminOpsService.userPortfolio', () => {
  it('gives support a member\'s holdings, cost source, failed imports and recent activity', async () => {
    const out = await make().svc.userPortfolio('u1');
    expect(out.user.email).toBe('ann@x.com');
    expect(out.holdings[0]).toMatchObject({ ticker: 'NSE', broker: 'Equity', costSource: 'IMPORT_PRICE', tradeCount: 2 });
    expect(out.statementImports[0]).toMatchObject({ status: 'failed', error: 'Could not read PDF' });
  });
  it('404s for an unknown member', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.userPortfolio('nope')).rejects.toThrow(NotFoundException);
  });
});

describe('AdminOpsService system views', () => {
  it('assembles live system health for today and the AI usage of the last 7 days', async () => {
    const { svc, health, aiUsage, facts } = make();
    const now = new Date('2026-11-06T10:00:00Z');
    const out = await svc.systemHealth(now);
    expect(facts.latestSessionYmd).toHaveBeenCalledWith(now);
    expect(health.build.mock.calls[0][0].ymd).toBe('2026-11-06');
    expect(health.build.mock.calls[0][2]).toBe('2026-11-05');
    expect(aiUsage.summary.mock.calls[0][0].getTime()).toBe(now.getTime() - 7 * 86_400_000);
    expect(out).toMatchObject({ jobs: [{ name: 'a' }], aiLast7Days: [{ feature: 'advisor' }] });
  });
  it('returns recent job runs and AI calls, capped', async () => {
    const { svc, jobs, prisma } = make();
    await svc.recentJobRuns('market-poll', 20);
    expect(jobs.recent).toHaveBeenCalledWith('market-poll', 20);
    await svc.aiCalls('advisor', 9999);
    expect(prisma.aiCall.findMany.mock.calls[0][0]).toMatchObject({ where: { feature: 'advisor' }, take: 200 });
  });
});

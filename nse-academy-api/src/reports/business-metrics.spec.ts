import { BusinessMetricsService, monthStart, paymentAmountKes, recurringRevenue } from './business-metrics.service';
import { boundsForYmd } from './report-helpers';

describe('paymentAmountKes', () => {
  it('values a ledger row at what Paystack charged, term discount included', () => {
    expect(paymentAmountKes('premium', 1)).toBe(500);
    expect(paymentAmountKes('intermediary', 3)).toBe(855);
    expect(paymentAmountKes('premium', 12)).toBe(5100);
  });
  it('counts an unknown plan as nothing and an odd term as one month rather than inventing revenue', () => {
    expect(paymentAmountKes('platinum', 1)).toBe(0);
    expect(paymentAmountKes('premium', 7)).toBe(500);
  });
});

describe('recurringRevenue', () => {
  it('is members times the plan\'s monthly list price, and a year is twelve of them', () => {
    expect(recurringRevenue(2, 1)).toEqual({ mrrKes: 1300, arrKes: 15600 });
    expect(recurringRevenue(0, 0)).toEqual({ mrrKes: 0, arrKes: 0 });
  });
});

describe('monthStart', () => {
  it('is midnight Nairobi on the 1st of the month the day falls in', () => {
    expect(monthStart(boundsForYmd('2026-11-05')).toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(monthStart(boundsForYmd('2026-11-01')).toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(monthStart(boundsForYmd('2026-12-31')).toISOString()).toBe('2026-11-30T21:00:00.000Z');
  });
});

describe('BusinessMetricsService.build', () => {
  const day = boundsForYmd('2026-11-05');
  const now = new Date('2026-11-06T05:00:00Z');
  const at = (iso: string) => new Date(iso);

  function make() {
    const payments = [
      { plan: 'premium', months: 12, appliedAt: at('2026-11-05T09:00:00Z'), userId: 'a' }, // yesterday: 5,100
      { plan: 'intermediary', months: 1, appliedAt: at('2026-11-05T15:00:00Z'), userId: 'b' }, // yesterday: 300
      { plan: 'premium', months: 1, appliedAt: at('2026-11-02T09:00:00Z'), userId: 'c' }, // earlier this month: 500
      { plan: 'premium', months: 1, appliedAt: at('2026-10-20T09:00:00Z'), userId: 'd' }, // last month, inside 30 days: 500
    ];
    const count = jest.fn(async ({ where }: any) => {
      if (where.notificationType) return 0;
      if (where.type === 'PORTFOLIO_WATCH') return 2;
      if (where.status === 'failed') return 1;
      if (where.status === 'completed') return 4;
      return 7;
    });
    const prisma = {
      processedPayment: { findMany: jest.fn().mockResolvedValue(payments), aggregate: jest.fn().mockResolvedValue({ _min: { appliedAt: at('2026-10-20T09:00:00Z') } }) },
      subscription: { groupBy: jest.fn().mockResolvedValue([{ tier: 'premium', _count: 2 }, { tier: 'intermediary', _count: 1 }]), count },
      user: { count },
      trade: { count }, statementImport: { count }, notification: { count }, priceAlert: { count }, lessonProgress: { count },
    };
    return { svc: new BusinessMetricsService(prisma as never), prisma };
  }

  it('sums revenue for the day, the month and 30 days from the payment ledger', async () => {
    const { svc } = make();
    const m = await svc.build(day, now);
    expect(m.revenue).toEqual({ dayKes: 5400, dayPayments: 2, monthToDateKes: 5900, last30DaysKes: 6400, recordedSince: '2026-10-20' });
  });

  it('computes recurring revenue from active paid members by tier', async () => {
    const { svc } = make();
    expect((await svc.build(day, now)).recurring).toEqual({ activePaid: 3, premium: 2, intermediary: 1, mrrKes: 1300, arrKes: 15600 });
  });

  it('reads the ledger window from the earlier of the month start and 30 days back, and ends at the day\'s end', async () => {
    const { svc, prisma } = make();
    await svc.build(day, now);
    const where = prisma.processedPayment.findMany.mock.calls[0][0].where.appliedAt;
    expect(where.lt).toEqual(day.end);
    expect(where.gte.getTime()).toBe(Math.min(monthStart(day).getTime(), day.end.getTime() - 30 * 86_400_000));
  });

  it('reports no ledger start when nothing has been recorded', async () => {
    const { svc, prisma } = make();
    prisma.processedPayment.findMany.mockResolvedValue([]);
    prisma.processedPayment.aggregate.mockResolvedValue({ _min: { appliedAt: null } });
    const m = await svc.build(day, now);
    expect(m.revenue).toEqual({ dayKes: 0, dayPayments: 0, monthToDateKes: 0, last30DaysKes: 0, recordedSince: null });
  });

  it('counts the funnel over the last 30 days with each stage as a separate condition', async () => {
    const { svc, prisma } = make();
    await svc.build(day, now);
    const userWheres = (prisma.user.count as jest.Mock).mock.calls.map((c) => JSON.stringify(c[0].where));
    expect(userWheres.some((w) => w.includes('investorProfile'))).toBe(true);
    expect(userWheres.some((w) => w.includes('holdings') && w.includes('trades'))).toBe(true);
    expect(userWheres.some((w) => w.includes('subscription') && w.includes('premium'))).toBe(true);
  });
});

import { periodPerformance, previousQuarter, renderReview } from './review';
import { PortfolioReviewService } from './portfolio-review.service';
import { allocationRows, planRebalance, sectorExposure } from './rebalance';

describe('previousQuarter', () => {
  it('names the quarter that has just ended, in Nairobi time', () => {
    expect(previousQuarter(new Date('2026-10-02T06:00:00Z'))).toMatchObject({ key: '2026-Q3', label: 'Q3 2026', dayOfMonth: 2, month: 10 });
    expect(previousQuarter(new Date('2027-01-05T06:00:00Z'))).toMatchObject({ key: '2026-Q4', label: 'Q4 2026' });
    expect(previousQuarter(new Date('2026-07-01T00:30:00Z'))).toMatchObject({ key: '2026-Q2' });
    expect(previousQuarter(new Date('2026-09-30T22:00:00Z'))).toMatchObject({ key: '2026-Q3', dayOfMonth: 1, month: 10 }); // already 1 October in Nairobi, but the quarter test is on the Nairobi date
  });
});

describe('periodPerformance', () => {
  const mk = (start: number, end: number, from = '2026-08-04') => {
    const out: { date: string; price: number }[] = [];
    for (let i = 0; i <= 90; i++) {
      const d = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      out.push({ date: d, price: start + ((end - start) * i) / 90 });
    }
    return out;
  };
  const positions = [
    { ticker: 'AAA', quantity: 100, price: 120, feePct: 1, brokerName: 'B' },
    { ticker: 'BBB', quantity: 200, price: 40, feePct: 1, brokerName: 'B' },
  ];

  it('values today\'s shares then and now over the window, and ranks the stocks', () => {
    const series = new Map([['AAA', mk(100, 120)], ['BBB', mk(50, 40)]]);
    const p = periodPerformance(positions, series, '2026-11-02', 90)!;
    expect(p.changeKes).toBeCloseTo(100 * 20 + 200 * -10, 6);
    expect(p.perStock.map((s) => s.ticker)).toEqual(['AAA', 'BBB']);
    expect(p.perStock[0].pct).toBeCloseTo(20, 6);
  });

  it('leaves out a stock without history reaching back to the window, rather than describing a shorter period', () => {
    const short = mk(10, 11, '2026-10-20').filter((c) => c.date >= '2026-10-20');
    const p = periodPerformance(positions, new Map([['AAA', mk(100, 120)], ['BBB', short]]), '2026-11-02', 90)!;
    expect(p.perStock.map((s) => s.ticker)).toEqual(['AAA']);
    expect(periodPerformance(positions, new Map([['BBB', short]]), '2026-11-02', 90)).toBeNull();
  });
});

describe('renderReview', () => {
  const positions = [
    { ticker: 'SCOM', quantity: 2000, price: 30, feePct: 1.5, brokerName: 'A' },
    { ticker: 'KCB', quantity: 100, price: 90, feePct: 1, brokerName: 'B' },
  ];
  const rows = allocationRows(positions, { SCOM: 'Telecommunications', KCB: 'Banking Sector' });
  const base = { firstName: 'Jane Doe', periodLabel: 'Q3 2026', asOfLabel: 'Thursday 5 November 2026', siteUrl: 'https://x.test', valueKes: 69_000, performance: null, rows, sectors: sectorExposure(rows), notes: ['SCOM is 87% of your portfolio.'] };

  it('invites members with no targets to set them, and shows sectors', () => {
    const out = renderReview({ ...base, drift: null, plan: null });
    expect(out.subject).toBe('Your Q3 2026 portfolio review');
    expect(out.html).toContain('Set your targets');
    expect(out.html).toContain('Telecommunications');
    expect(out.html).toContain('SCOM is 87% of your portfolio.');
    expect(out.html).toContain('https://x.test/dashboard/journal/allocation');
  });

  it('shows drift, the trades to get back, and what they would cost in fees', () => {
    const plan = planRebalance({ positions, targets: [{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'KCB', weightPct: 50 }] });
    const out = renderReview({ ...base, drift: plan.drift, plan });
    expect(out.html).toContain('Getting back to your targets');
    expect(out.html).toContain('Sell');
    expect(out.html).toContain('Broker fees would total');
    expect(out.html).toContain('Off by');
    expect(out.text).toMatch(/sell \d+ SCOM/);
    expect(out.html).not.toMatch(/you should|we recommend/i);
  });

  it('says nothing needs to change when every stock is on target', () => {
    const plan = planRebalance({ positions: [positions[0], { ...positions[1], quantity: 667 }], targets: [{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'KCB', weightPct: 50 }] });
    const out = renderReview({ ...base, drift: plan.drift, plan });
    expect(out.html).toContain('nothing needs to change');
  });

  it('escapes stock codes and sector names', () => {
    const evil = allocationRows([{ ticker: 'A<B', quantity: 1, price: 10, feePct: null, brokerName: null }], { 'A<B': '<script>x</script>' });
    const out = renderReview({ ...base, rows: evil, sectors: sectorExposure(evil), drift: null, plan: null, notes: [] });
    expect(out.html).not.toContain('<script>x</script>');
  });
});

describe('PortfolioReviewService.runAll', () => {
  function make() {
    const prisma = {
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]), findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, email: `${where.id}@x.com`, name: 'N' })) },
      portfolioReview: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      $queryRaw: jest.fn().mockResolvedValue([{ ticker: 'SCOM', d: '2026-10-02', price: 30 }]),
    };
    const rows = allocationRows([{ ticker: 'SCOM', quantity: 100, price: 30, feePct: null, brokerName: null }], {});
    const allocation = {
      overview: jest.fn().mockResolvedValue({ valueKes: 3000, rows, sectors: sectorExposure(rows), notes: [], targets: [], unpriced: [] }),
      loadPortfolio: jest.fn().mockResolvedValue({ positions: [{ ticker: 'SCOM', quantity: 100, price: 30, feePct: null, brokerName: null }] }),
      plan: jest.fn(),
    };
    const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockReturnValue(undefined) };
    return { svc: new PortfolioReviewService(prisma as never, allocation as never, brevo as never, config as never), prisma, brevo, allocation };
  }

  it('does nothing after the first week of the quarter', async () => {
    const { svc, brevo } = make();
    const out = await svc.runAll(new Date('2026-10-12T06:00:00Z'));
    expect(out.note).toMatch(/first 7 days/);
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('sends each eligible Premium member one review for the quarter and records it', async () => {
    const { svc, prisma, brevo } = make();
    const out = await svc.runAll(new Date('2026-10-02T06:00:00Z'));
    expect(out).toMatchObject({ period: '2026-Q3', considered: 2, sent: 2, failed: 0 });
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
    expect(prisma.portfolioReview.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { userId: 'u1', period: '2026-Q3' } }));
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.subscription.is.tier).toBe('premium');
    expect(where.portfolioReviews).toEqual({ none: { period: '2026-Q3' } });
  });

  it('skips a member already sent this quarter, and a failure does not stop the rest', async () => {
    const { svc, prisma, brevo } = make();
    prisma.portfolioReview.findUnique.mockResolvedValueOnce({ id: 'x' }).mockResolvedValue(null);
    const first = await svc.runAll(new Date('2026-10-02T06:00:00Z'));
    expect(first).toMatchObject({ sent: 1, skipped: 1 });
    brevo.sendTransactional.mockRejectedValueOnce(new Error('down')).mockResolvedValue(undefined);
    const second = await svc.runAll(new Date('2026-10-02T06:00:00Z'));
    expect(second).toMatchObject({ sent: 1, failed: 1 });
  });
});

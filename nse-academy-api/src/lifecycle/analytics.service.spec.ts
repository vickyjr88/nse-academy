import { AnalyticsService } from './analytics.service';

function makeService() {
  const prisma = {
    flowEntry: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      count: jest.fn().mockResolvedValue(0),
    },
    subscription: {
      count: jest.fn().mockResolvedValue(0),
    },
    broadcastCampaign: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const service = new AnalyticsService(prisma as never);
  return { service, prisma };
}

describe('AnalyticsService.getFlowSummaries', () => {
  it('returns a zeroed row for every known flow even with no data', async () => {
    const { service } = makeService();
    const result = await service.getFlowSummaries();
    expect(result).toHaveLength(7);
    expect(result.every((r) => r.entered === 0)).toBe(true);
  });

  it('buckets counts by outcome per flow', async () => {
    const { service, prisma } = makeService();
    (prisma.flowEntry.groupBy as jest.Mock).mockResolvedValueOnce([
      { flow: 'day1-nurture', outcome: 'sent', _count: { _all: 10 } },
      { flow: 'day1-nurture', outcome: 'failed', _count: { _all: 2 } },
      { flow: 'winback', outcome: 'pending', _count: { _all: 1 } },
    ]);
    const result = await service.getFlowSummaries();
    const day1 = result.find((r) => r.flow === 'day1-nurture')!;
    expect(day1).toEqual({ flow: 'day1-nurture', entered: 12, sent: 10, failed: 2, pending: 0, skipped: 0 });
    const winback = result.find((r) => r.flow === 'winback')!;
    expect(winback.pending).toBe(1);
    expect(winback.entered).toBe(1);
  });

  it('ignores an unrecognized flow value rather than crashing', async () => {
    const { service, prisma } = makeService();
    (prisma.flowEntry.groupBy as jest.Mock).mockResolvedValueOnce([
      { flow: 'some-future-flow-not-in-the-enum', outcome: 'sent', _count: { _all: 5 } },
    ]);
    const result = await service.getFlowSummaries();
    expect(result.every((r) => r.entered === 0)).toBe(true);
  });
});

describe('AnalyticsService.getSignupFunnel', () => {
  it('reports strictly the six named stages in order', async () => {
    const { service, prisma } = makeService();
    (prisma.user.count as jest.Mock).mockResolvedValueOnce(100);
    (prisma.flowEntry.findMany as jest.Mock)
      .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }]) // day1
      .mockResolvedValueOnce([{ userId: 'u1' }]) // day7
      .mockResolvedValueOnce([]) // day14
      .mockResolvedValueOnce([]); // engaged
    (prisma.subscription.count as jest.Mock).mockResolvedValueOnce(5);

    const funnel = await service.getSignupFunnel();
    expect(funnel.map((f) => f.stage)).toEqual([
      'Signed up',
      'Day 1 email sent',
      'Day 7 email sent',
      'Day 14 pitch sent',
      'Tagged engaged-free',
      'Converted to paid',
    ]);
    expect(funnel[0].count).toBe(100);
    expect(funnel[1].count).toBe(2);
    expect(funnel[5].count).toBe(5);
  });
});

describe('AnalyticsService.getCampaignReport', () => {
  it('computes a failure rate from total sent vs failed across all campaigns', async () => {
    const { service, prisma } = makeService();
    (prisma.broadcastCampaign.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'c1', subject: 'A', tier: null, audienceCount: 90, failedCount: 10, createdAt: new Date() },
      { id: 'c2', subject: 'B', tier: 'free', audienceCount: 50, failedCount: 0, createdAt: new Date() },
    ]);
    const report = await service.getCampaignReport();
    expect(report.totalCampaigns).toBe(2);
    expect(report.totalSent).toBe(140);
    expect(report.totalFailed).toBe(10);
    expect(report.failureRate).toBeCloseTo(10 / 150);
  });

  it('failure rate is 0, not NaN, when nothing has been sent yet', async () => {
    const { service } = makeService();
    const report = await service.getCampaignReport();
    expect(report.failureRate).toBe(0);
  });
});

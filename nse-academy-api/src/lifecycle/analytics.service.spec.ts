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
    expect(result).toHaveLength(9);
    expect(result.every((r) => r.entered === 0)).toBe(true);
  });

  it('buckets counts by outcome per flow, plus separate opened/clicked counts', async () => {
    const { service, prisma } = makeService();
    (prisma.flowEntry.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { flow: 'day1-nurture', outcome: 'sent', _count: { _all: 10 } },
        { flow: 'day1-nurture', outcome: 'failed', _count: { _all: 2 } },
        { flow: 'winback', outcome: 'pending', _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([{ flow: 'day1-nurture', _count: { _all: 6 } }]) // opened
      .mockResolvedValueOnce([{ flow: 'day1-nurture', _count: { _all: 3 } }]); // clicked
    const result = await service.getFlowSummaries();
    const day1 = result.find((r) => r.flow === 'day1-nurture')!;
    expect(day1).toEqual({
      flow: 'day1-nurture',
      entered: 12,
      sent: 10,
      failed: 2,
      pending: 0,
      skipped: 0,
      opened: 6,
      clicked: 3,
    });
    const winback = result.find((r) => r.flow === 'winback')!;
    expect(winback.pending).toBe(1);
    expect(winback.entered).toBe(1);
    expect(winback.opened).toBe(0);
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
  it('reports strictly the seven named stages in order, including Day 14 click-through', async () => {
    const { service, prisma } = makeService();
    (prisma.user.count as jest.Mock).mockResolvedValueOnce(100);
    (prisma.flowEntry.findMany as jest.Mock)
      .mockResolvedValueOnce([{ userId: 'u1' }, { userId: 'u2' }]) // day1
      .mockResolvedValueOnce([{ userId: 'u1' }]) // day7
      .mockResolvedValueOnce([{ userId: 'u1' }]) // day14 sent
      .mockResolvedValueOnce([]) // day14 clicked
      .mockResolvedValueOnce([]); // engaged
    (prisma.subscription.count as jest.Mock).mockResolvedValueOnce(5);

    const funnel = await service.getSignupFunnel();
    expect(funnel.map((f) => f.stage)).toEqual([
      'Signed up',
      'Day 1 email sent',
      'Day 7 email sent',
      'Day 14 pitch sent',
      'Day 14 pitch clicked',
      'Tagged engaged-free',
      'Converted to paid',
    ]);
    expect(funnel[0].count).toBe(100);
    expect(funnel[1].count).toBe(2);
    expect(funnel[3].count).toBe(1);
    expect(funnel[4].count).toBe(0);
    expect(funnel[6].count).toBe(5);
  });
});

describe('AnalyticsService.getVariantResults', () => {
  it('aggregates sent/opened/clicked per variant from FlowEntry.metadata.variant', async () => {
    const { service, prisma } = makeService();
    (prisma.flowEntry.findMany as jest.Mock).mockResolvedValueOnce([
      { userId: 'u1', metadata: { variant: 'trade-journal' }, openedAt: new Date(), clickedAt: new Date() },
      { userId: 'u2', metadata: { variant: 'trade-journal' }, openedAt: new Date(), clickedAt: null },
      { userId: 'u3', metadata: { variant: 'stock-advisor' }, openedAt: null, clickedAt: null },
    ]);
    (prisma.user.count as jest.Mock).mockResolvedValueOnce(1).mockResolvedValueOnce(0); // converted per variant

    const results = await service.getVariantResults('day14-nurture');
    expect(results).toEqual([
      { variant: 'stock-advisor', sent: 1, opened: 0, clicked: 0, converted: 0 },
      { variant: 'trade-journal', sent: 2, opened: 2, clicked: 1, converted: 1 },
    ]);
  });

  it('buckets a row with no variant in metadata as "unknown" rather than dropping it', async () => {
    const { service, prisma } = makeService();
    (prisma.flowEntry.findMany as jest.Mock).mockResolvedValueOnce([
      { userId: 'u1', metadata: null, openedAt: null, clickedAt: null },
    ]);
    const results = await service.getVariantResults('winback');
    expect(results.map((r) => r.variant)).toEqual(['unknown']);
  });

  it('counts a userId only once per variant even with multiple FlowEntry rows (defensive - sentAt dedupe should prevent this)', async () => {
    const { service, prisma } = makeService();
    (prisma.flowEntry.findMany as jest.Mock).mockResolvedValueOnce([
      { userId: 'u1', metadata: { variant: 'social-proof' }, openedAt: null, clickedAt: null },
      { userId: 'u1', metadata: { variant: 'social-proof' }, openedAt: null, clickedAt: null },
    ]);
    const results = await service.getVariantResults('winback');
    expect(results[0].sent).toBe(1);
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

import { AnalyticsService } from './analytics.service';

function make(raw: unknown[][] = []) {
  const queue = [...raw];
  const prisma = {
    pageView: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 4 }) },
    signupAttribution: { upsert: jest.fn().mockResolvedValue({}) },
    $queryRaw: jest.fn(async () => queue.shift() ?? []),
  };
  return { svc: new AnalyticsService(prisma as never), prisma };
}

describe('AnalyticsService', () => {
  it('stores a page view, and never throws if the write fails', async () => {
    const { svc, prisma } = make();
    const view = { visitorId: 'v'.repeat(20), path: '/', referrerHost: null, utmSource: null, utmMedium: null, utmCampaign: null, device: 'mobile' as const };
    await svc.record(view);
    expect(prisma.pageView.create).toHaveBeenCalledWith({ data: view });
    prisma.pageView.create.mockRejectedValue(new Error('db down'));
    await expect(svc.record(view)).resolves.toBeUndefined();
  });

  it('turns the database rows into numbers (Postgres returns counts as bigint)', async () => {
    const { svc } = make([
      [{ views: 120n, visitors: 40n }],
      [{ path: '/pricing', views: 30n, visitors: 20n }],
      [{ source: 'google.com', views: 50n, visitors: 25n }, { source: 'direct', views: 10n, visitors: 8n }],
      [{ campaign: 'nov-launch', views: 9n, visitors: 6n }],
      [{ device: 'mobile', views: 90n }, { device: 'desktop', views: 30n }],
      [{ source: 'whatsapp', signups: 5n, paying: 2n }],
    ]);
    const w = await svc.window(new Date('2026-11-01'), new Date('2026-11-08'));
    expect(w).toEqual({
      pageViews: 120, visitors: 40,
      topPages: [{ path: '/pricing', views: 30, visitors: 20 }],
      sources: [{ source: 'google.com', views: 50, visitors: 25 }, { source: 'direct', views: 10, visitors: 8 }],
      campaigns: [{ campaign: 'nov-launch', views: 9, visitors: 6 }],
      devices: [{ device: 'mobile', views: 90 }, { device: 'desktop', views: 30 }],
      signups: [{ source: 'whatsapp', signups: 5, paying: 2 }],
    });
  });

  it('returns zeros for a period with no traffic', async () => {
    const { svc } = make();
    expect(await svc.window(new Date('2026-11-01'), new Date('2026-11-08'))).toMatchObject({ pageViews: 0, visitors: 0, topPages: [], sources: [] });
  });

  it('builds a zero-filled per-day series ending today and compares with the period before', async () => {
    const now = new Date('2026-11-05T10:00:00Z'); // 13:00 in Nairobi
    const { svc } = make([
      [{ views: 10n, visitors: 4n }], [], [], [], [], [], // current window
      [{ views: 5n, visitors: 2n }], // previous period
      [{ day: '2026-11-05', views: 6n, visitors: 3n }, { day: '2026-11-03', views: 4n, visitors: 2n }], // series
    ]);
    const r = await svc.report(5, now);
    expect(r.series.map((s) => s.day)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(r.series[4]).toEqual({ day: '2026-11-05', views: 6, visitors: 3 });
    expect(r.series[3]).toEqual({ day: '2026-11-04', views: 0, visitors: 0 });
    expect(r.previous).toEqual({ pageViews: 5, visitors: 2 });
    expect(r).toMatchObject({ days: 5, pageViews: 10, visitors: 4 });
  });

  it('keeps the requested period within 1 to 90 days', async () => {
    expect((await make().svc.report(0)).days).toBe(30);
    expect((await make().svc.report(9999)).days).toBe(90);
    expect((await make().svc.report(-5)).days).toBe(1);
  });

  it('records signup attribution once per member and never throws', async () => {
    const { svc, prisma } = make();
    await svc.recordSignupAttribution('u1', { utmSource: 'whatsapp' });
    expect(prisma.signupAttribution.upsert).toHaveBeenCalledWith({ where: { userId: 'u1' }, create: { userId: 'u1', utmSource: 'whatsapp' }, update: {} });
    prisma.signupAttribution.upsert.mockRejectedValue(new Error('db down'));
    await expect(svc.recordSignupAttribution('u1', {})).resolves.toBeUndefined();
  });

  it('prunes old page views', async () => {
    await expect(make().svc.prune(400)).resolves.toBe(4);
  });
});

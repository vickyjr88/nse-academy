import { AdminMetricsService, SERIES, buildAttention, dayRange, eatDay, failingJobs, fillDays, monthsFromBasePlan, pctChange } from './admin-metrics.service';

const now = new Date('2026-11-16T10:00:00Z'); // 13:00 in Nairobi

describe('dates', () => {
  it('uses Nairobi days: a moment after 21:00 UTC is already tomorrow', () => {
    expect(eatDay(new Date('2026-11-15T21:30:00Z'))).toBe('2026-11-16');
    expect(eatDay(new Date('2026-11-15T20:30:00Z'))).toBe('2026-11-15');
  });
  it('lists the last N days oldest first, ending today', () => {
    const r = dayRange(now, 5);
    expect(r).toEqual(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
  });
  it('fills days with no data with zeros and keeps order', () => {
    const out = fillDays(dayRange(now, 3), [{ day: '2026-11-15', count: 4 }], { count: 0 });
    expect(out).toEqual([{ day: '2026-11-14', count: 0 }, { day: '2026-11-15', count: 4 }, { day: '2026-11-16', count: 0 }]);
  });
});

describe('pctChange', () => {
  it('is relative to the earlier figure, to one decimal', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(80, 100)).toBe(-20);
    expect(pctChange(1, 3)).toBe(-66.7);
  });
  it('has nothing to say when there is nothing to compare with', () => {
    expect(pctChange(5, 0)).toBeNull();
  });
});

describe('monthsFromBasePlan', () => {
  it('reads the billing length from the plan id Play was set up with', () => {
    expect(monthsFromBasePlan('monthly')).toBe(1);
    expect(monthsFromBasePlan('quarterly')).toBe(3);
    expect(monthsFromBasePlan('semiannual')).toBe(6);
    expect(monthsFromBasePlan('annual')).toBe(12);
    expect(monthsFromBasePlan(null)).toBe(1);
  });
});

describe('failingJobs', () => {
  it('judges a job by its latest finished run, not by an old failure', () => {
    const t = new Date();
    const runs = [
      { job: 'a', ok: true, finishedAt: t }, // latest of a: fine
      { job: 'a', ok: false, finishedAt: t }, // older failure: ignored
      { job: 'b', ok: false, finishedAt: t }, // latest of b: failing
      { job: 'c', ok: false, finishedAt: null }, // still running: not judged
      { job: 'c', ok: true, finishedAt: t }, // its previous finished run was fine
    ];
    expect(failingJobs(runs)).toEqual(['b']);
  });
});

describe('buildAttention', () => {
  const none = { pendingAdvisors: 0, newContacts: 0, expiringSoon: 0, playOnHold: 0, failedImports: 0, failingJobs: [], failedAiCalls: 0 };
  it('says nothing when nothing needs attention', () => {
    expect(buildAttention(none)).toEqual([]);
  });
  it('puts the most urgent first and links each item to the page that resolves it', () => {
    const items = buildAttention({ ...none, expiringSoon: 3, pendingAdvisors: 2, failingJobs: ['market-poll'], newContacts: 9 });
    expect(items.map((i) => i.key)).toEqual(['jobs', 'contacts', 'advisors', 'expiring']);
    expect(items.find((i) => i.key === 'advisors')).toMatchObject({ count: 2, route: 'members/advisors' });
    expect(items.find((i) => i.key === 'contacts')?.severity).toBe('high'); // more than five unread
  });
});

describe('SERIES', () => {
  it('only names tables and columns written in this file', () => {
    for (const s of Object.values(SERIES)) {
      expect(s.table).toMatch(/^[A-Za-z]+$/);
      expect(s.at).toMatch(/^[A-Za-z]+$/);
      if (s.sum) expect(s.sum).toMatch(/^[A-Za-z]+$/);
    }
  });
});

describe('AdminMetricsService', () => {
  it('refuses a metric that is not in the list', async () => {
    const svc = new AdminMetricsService({} as any, {} as any, {} as any);
    expect(await svc.series('users; drop table "User"', 30)).toBeNull();
  });

  it('returns a zero-filled series for the days asked, with the previous period\'s total', async () => {
    const prisma: any = { $queryRawUnsafe: jest.fn().mockResolvedValue([
      { day: '2026-11-15', count: 3n },
      { day: '2026-11-16', count: 2n },
      { day: '2026-10-20', count: 4n }, // in the previous period
    ]) };
    const svc = new AdminMetricsService(prisma, {} as any, {} as any);
    const out = await svc.series('signups', 7, now);
    expect(out!.series).toHaveLength(7);
    expect(out!.total).toBe(5);
    expect(out!.previousTotal).toBe(4);
    expect(out!.change).toBe(25);
    expect(out!.series.at(-1)).toEqual({ day: '2026-11-16', count: 2, value: 0 });
    const [sql, from] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('FROM "User"');
    expect(sql).toContain("AT TIME ZONE 'Africa/Nairobi'");
    expect(from).toBeInstanceOf(Date);
  });

  it('builds the overview from the database, counting Play subscriptions apart from web ones', async () => {
    const empty = jest.fn().mockResolvedValue([]);
    const count = (n: number) => jest.fn().mockResolvedValue(n);
    const prisma: any = {
      user: { count: jest.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(12).mockResolvedValueOnce(8), findMany: jest.fn().mockResolvedValue([{ id: 'u1', name: 'Ann', createdAt: new Date('2026-11-15T08:00:00Z') }]) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([{ tier: 'premium', source: 'play' }, { tier: 'premium', source: 'paystack' }, { tier: 'intermediary', source: 'paystack' }]),
        count: jest.fn().mockResolvedValue(1),
      },
      processedPayment: { findMany: jest.fn().mockResolvedValue([{ appliedAt: new Date('2026-11-10T08:00:00Z'), plan: 'premium', months: 1, userId: 'u2' }]) },
      playPurchase: { findMany: jest.fn().mockResolvedValue([{ createdAt: new Date('2026-11-12T08:00:00Z'), tier: 'premium', basePlanId: 'monthly', userId: 'u3' }]), count: count(1) },
      investorProfile: { count: count(5) },
      advisorProfile: { count: count(2) },
      contactSubmission: { count: count(3) },
      statementImport: { count: count(0) },
      jobRun: { findMany: jest.fn().mockResolvedValue([{ job: 'market-poll', ok: false, finishedAt: new Date() }]) },
      aiCall: { count: count(0) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ day: '2026-11-15', count: 4n }]),
    };
    void empty;
    const activity: any = { metrics: jest.fn().mockResolvedValue({ dau: 10, wau: 40, mau: 90, stickinessPct: 11, series: [], trackingSince: '2026-10-01' }) };
    const analytics: any = { report: jest.fn().mockResolvedValue({ visitors: 500, pageViews: 1500, previous: { visitors: 400, pageViews: 1000 }, series: [] }) };
    const out = await new AdminMetricsService(prisma, activity, analytics).overview(30, now);

    expect(out.members).toMatchObject({ total: 100, new: 12, previousNew: 8, newChange: 50 });
    expect(out.paying).toMatchObject({ total: 3, premium: 2, intermediary: 1, web: 2, play: 1 });
    expect(out.plans).toEqual({ free: 97, intermediary: 1, premium: 2 });
    expect(out.mrr.kes).toBe(2 * 500 + 300);
    expect(out.revenue.kes).toBe(1000); // one web payment and one Play subscription, each KSh 500
    expect(out.revenue.series.reduce((s, d) => s + d.web, 0)).toBe(500);
    expect(out.revenue.series.reduce((s, d) => s + d.play, 0)).toBe(500);
    expect(out.revenue.playIsEstimate).toBe(true);
    expect(out.funnel.map((f) => f.value)).toEqual([500, 12, 5, 2]); // two different people paid
    expect(out.attention[0]).toMatchObject({ key: 'jobs', severity: 'high' });
    expect(out.feed[0].kind).toBeDefined();
    expect(out.active.mau).toBe(90);
  });
});

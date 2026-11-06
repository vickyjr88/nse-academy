import { ActivityService, nairobiYmd, ymdMinus } from './activity.service';

function make(over: Record<string, unknown> = {}) {
  const upserts: any[] = [];
  const prisma: any = {
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
    activityDay: {
      upsert: jest.fn((a: any) => { upserts.push(a); return Promise.resolve({}); }),
      aggregate: jest.fn().mockResolvedValue({ _min: { day: '2026-10-01' } }),
      count: jest.fn().mockResolvedValue(6),
      groupBy: jest.fn(async ({ by }: any) => (by[0] === 'userId' ? Array.from({ length: 11 }, (_, i) => ({ userId: `u${i}` })) : [{ day: '2026-11-05', _count: { _all: 6 } }, { day: '2026-11-03', _count: { _all: 4 } }])),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    subscription: { findMany: jest.fn().mockResolvedValue([{ tier: 'premium', currentPeriodEnd: new Date('2026-11-20T00:00:00Z'), user: { id: 'u9', name: 'Pat', email: 'p@x.com', lastActiveAt: new Date('2026-10-20T10:00:00Z') } }]) },
    ...over,
  };
  return { svc: new ActivityService(prisma), prisma, upserts };
}

describe('date helpers', () => {
  it('uses the Nairobi calendar day, which starts three hours before UTC', () => {
    expect(nairobiYmd(new Date('2026-11-05T20:59:00Z'))).toBe('2026-11-05');
    expect(nairobiYmd(new Date('2026-11-05T21:00:00Z'))).toBe('2026-11-06');
    expect(ymdMinus('2026-11-01', 1)).toBe('2026-10-31');
    expect(ymdMinus('2026-11-05', 29)).toBe('2026-10-07');
  });
});

describe('ActivityService.touch', () => {
  const t0 = new Date('2026-11-05T10:00:00Z');

  it('records the member against today (Nairobi) and updates their last-active time', async () => {
    const { svc, upserts, prisma } = make();
    await svc.touch('u1', t0);
    expect(upserts[0].where).toEqual({ userId_day: { userId: 'u1', day: '2026-11-05' } });
    expect(upserts[0].create).toMatchObject({ userId: 'u1', day: '2026-11-05' });
    expect(upserts[0].update).toMatchObject({ hits: { increment: 1 } });
    expect(prisma.user.update.mock.calls[0][0]).toEqual({ where: { id: 'u1' }, data: { lastActiveAt: t0 } });
  });

  it('writes at most once per ten minutes per member, however many requests they make', async () => {
    const { svc, prisma } = make();
    await svc.touch('u1', t0);
    await svc.touch('u1', new Date(t0.getTime() + 60_000));
    await svc.touch('u1', new Date(t0.getTime() + 9 * 60_000));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    await svc.touch('u1', new Date(t0.getTime() + 11 * 60_000));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    await svc.touch('u2', t0);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('never throws on a database failure, and retries on the next request', async () => {
    const { svc, prisma } = make();
    prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.touch('u1', t0)).resolves.toBeUndefined();
    await svc.touch('u1', new Date(t0.getTime() + 1000));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('a sign-in is stamped and always counts for the day, even right after another request', async () => {
    const { svc, prisma } = make();
    await svc.touch('u1', t0);
    await svc.recordLogin('u1', new Date(t0.getTime() + 1000));
    const loginUpdate = prisma.user.update.mock.calls.find((c: any) => c[0].data.lastLoginAt);
    expect(loginUpdate[0]).toMatchObject({ where: { id: 'u1' } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('a failed login stamp does not break the sign-in', async () => {
    const { svc, prisma } = make();
    prisma.user.update.mockRejectedValueOnce(new Error('db down'));
    await expect(svc.recordLogin('u1', t0)).resolves.toBeUndefined();
  });
});

describe('ActivityService.metrics', () => {
  it('reports daily, weekly and monthly actives, stickiness, and a zero-filled series ending today', async () => {
    const { svc } = make();
    const m = await svc.metrics('2026-11-05');
    expect(m).toMatchObject({ dau: 6, wau: 11, mau: 11, stickinessPct: 55, trackingSince: '2026-10-01', trackingDays: 36 });
    expect(m.series).toHaveLength(30);
    expect(m.series[29]).toEqual({ day: '2026-11-05', count: 6 });
    expect(m.series[27]).toEqual({ day: '2026-11-03', count: 4 });
    expect(m.series[28]).toEqual({ day: '2026-11-04', count: 0 });
  });

  it('lists paying members who have gone quiet, once there is enough history to say so', async () => {
    const { svc, prisma } = make();
    const m = await svc.metrics('2026-11-05');
    expect(m.dormantPaying).toEqual([{ userId: 'u9', name: 'Pat', email: 'p@x.com', tier: 'premium', lastActiveAt: '2026-10-20T10:00:00.000Z', endsOn: '2026-11-20' }]);
    const where = prisma.subscription.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'active', tier: { in: ['intermediary', 'premium'] } });
    expect(where.user.activityDays.none.day.gte).toBe('2026-10-23'); // 14 days ending 5 Nov
  });

  it('does not guess who is dormant while tracking is younger than the window', async () => {
    const { svc, prisma } = make();
    prisma.activityDay.aggregate.mockResolvedValue({ _min: { day: '2026-11-01' } });
    const m = await svc.metrics('2026-11-05');
    expect(m.trackingDays).toBe(5);
    expect(m.dormantPaying).toBeNull();
    expect(prisma.subscription.findMany).not.toHaveBeenCalled();
  });

  it('copes with no activity recorded at all', async () => {
    const { svc, prisma } = make();
    prisma.activityDay.aggregate.mockResolvedValue({ _min: { day: null } });
    prisma.activityDay.count.mockResolvedValue(0);
    prisma.activityDay.groupBy.mockResolvedValue([]);
    const m = await svc.metrics('2026-11-05');
    expect(m).toMatchObject({ trackingSince: null, trackingDays: 0, dau: 0, mau: 0, stickinessPct: null, dormantPaying: null });
  });
});

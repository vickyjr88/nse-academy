import { JobMonitorService } from './job-monitor.service';
import { tracked } from './track';

function make() {
  const rows: any[] = [];
  const prisma = {
    jobRun: {
      create: jest.fn(async ({ data }: any) => rows.push(data)),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  };
  return { svc: new JobMonitorService(prisma as never), prisma, rows };
}

describe('JobMonitorService.track', () => {
  it('records a successful run with its duration and a one-line summary, and returns the result untouched', async () => {
    const { svc, rows } = make();
    const out = await svc.track('demo', async () => ({ sent: 4 }), (r) => `${r.sent} sent`);
    expect(out).toEqual({ sent: 4 });
    expect(rows[0]).toMatchObject({ job: 'demo', ok: true, summary: '4 sent', error: undefined });
    expect(rows[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records a failure with the message and rethrows the same error, so the job behaves exactly as before', async () => {
    const { svc, rows } = make();
    await expect(svc.track('demo', async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(rows[0]).toMatchObject({ job: 'demo', ok: false, error: 'boom' });
  });

  it('never lets a recording failure break the job or hide its result', async () => {
    const { svc, prisma } = make();
    prisma.jobRun.create.mockRejectedValue(new Error('db down'));
    await expect(svc.track('demo', async () => 7)).resolves.toBe(7);
    await expect(svc.track('demo', async () => { throw new Error('real'); })).rejects.toThrow('real');
  });

  it('survives a summariser that throws, and trims long text', async () => {
    const { svc, rows } = make();
    await expect(svc.track('demo', async () => 1, () => { throw new Error('bad summary'); })).resolves.toBe(1);
    await svc.record('demo', { ok: false, error: 'x'.repeat(1000) });
    expect(rows[1].error).toHaveLength(300);
  });
});

describe('tracked', () => {
  it('runs the function directly when there is no monitor', async () => {
    await expect(tracked(undefined, 'x', async () => 5)).resolves.toBe(5);
  });
  it('goes through the monitor when there is one', async () => {
    const track = jest.fn(async (_j: string, fn: () => Promise<number>) => fn());
    await tracked({ track } as never, 'x', async () => 9);
    expect(track).toHaveBeenCalledWith('x', expect.any(Function), undefined);
  });
});

describe('JobMonitorService.health', () => {
  it('returns a verdict for every job in the spec list', async () => {
    const { svc } = make();
    const health = await svc.health(new Date('2026-11-05T10:00:00Z'));
    expect(health.length).toBeGreaterThan(10);
    expect(health.every((h) => h.status === 'no-data')).toBe(true); // nothing recorded yet
  });

  it('prunes old rows', async () => {
    const { svc } = make();
    await expect(svc.prune(30)).resolves.toBe(3);
  });
});

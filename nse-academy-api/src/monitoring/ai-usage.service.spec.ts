import { AiUsageService } from './ai-usage.service';

function make() {
  const created: any[] = [];
  const prisma = {
    aiCall: {
      create: jest.fn(async ({ data }: any) => created.push(data)),
      groupBy: jest.fn().mockResolvedValue([
        { feature: 'advisor', model: 'ling', _count: { _all: 4 }, _sum: { costUsd: 0.002, promptTokens: 8000, completionTokens: 1600, durationMs: 40000 } },
        { feature: 'market-report', model: 'haiku', _count: { _all: 1 }, _sum: { costUsd: null, promptTokens: null, completionTokens: null, durationMs: 21000 } },
      ]),
      count: jest.fn(async ({ where }: any) => (where.ok === false ? 1 : where.verified === true ? 3 : where.verified === false ? 1 : 0)),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
  return { svc: new AiUsageService(prisma as never), prisma, created };
}

describe('AiUsageService', () => {
  it('stores a call with sensible defaults and trims long detail', async () => {
    const { svc, created } = make();
    await svc.record({ feature: 'advisor', ok: true, detail: 'x'.repeat(500) });
    expect(created[0]).toMatchObject({ feature: 'advisor', ok: true, attempts: 1, model: null, verified: null, costUsd: null });
    expect(created[0].detail).toHaveLength(300);
  });

  it('never throws if the write fails', async () => {
    const { svc, prisma } = make();
    prisma.aiCall.create.mockRejectedValue(new Error('db down'));
    await expect(svc.record({ feature: 'advisor', ok: true })).resolves.toBeUndefined();
  });

  it('summarises calls, failures, verification and spend per feature and model, busiest first', async () => {
    const { svc } = make();
    const rows = await svc.summary(new Date('2026-11-05'), new Date('2026-11-06'));
    expect(rows.map((r) => r.feature)).toEqual(['advisor', 'market-report']);
    expect(rows[0]).toMatchObject({ calls: 4, failed: 1, verified: 3, unverified: 1, costUsd: 0.002, promptTokens: 8000, avgSeconds: 10 });
    expect(rows[1]).toMatchObject({ costUsd: 0, promptTokens: 0, avgSeconds: 21 });
  });

  it('prunes old rows', async () => {
    const { svc } = make();
    await expect(svc.prune()).resolves.toBe(2);
  });
});

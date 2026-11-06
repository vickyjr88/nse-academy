import { SystemHealthService } from './system-health.service';
import { boundsForYmd } from './report-helpers';
import { okJob } from './fixtures';

const day = boundsForYmd('2026-11-05');
const now = new Date('2026-11-06T05:00:00Z');

function make(polls: { ok: boolean; error: string | null }[], report: unknown = { status: 'published', aiGenerated: true, aiModel: 'haiku' }) {
  const prisma = {
    jobRun: { findMany: jest.fn().mockResolvedValue(polls) },
    $queryRaw: jest.fn().mockResolvedValueOnce([{ n: 52n, last: new Date('2026-11-05T14:56:00Z') }]).mockResolvedValueOnce([{ last: new Date('2026-11-05T14:56:00Z') }]),
    marketReport: { findUnique: jest.fn().mockResolvedValue(report) },
  };
  const jobs = { health: jest.fn().mockResolvedValue([okJob('a')]) };
  const aiUsage = { summary: jest.fn().mockResolvedValue([{ feature: 'advisor', model: 'm', calls: 3, failed: 1, verified: 1, unverified: 1, costUsd: 0.002, promptTokens: 1, completionTokens: 1, avgSeconds: 4 }]) };
  const brevo = { getEmailStats: jest.fn().mockResolvedValue({ requests: 10 }), getCampaignStats: jest.fn().mockResolvedValue([]) };
  return { svc: new SystemHealthService(prisma as never, jobs as never, aiUsage as never, brevo as never), prisma, brevo, aiUsage };
}

describe('SystemHealthService.build', () => {
  it('counts price polls for the day and groups why the failed ones failed', async () => {
    const polls = [
      ...Array(25).fill({ ok: true, error: null }),
      ...Array(20).fill({ ok: false, error: 'HTTP 429' }),
      ...Array(2).fill({ ok: false, error: 'timeout' }),
      { ok: false, error: null },
    ];
    const r = await make(polls).svc.build(day, now, '2026-11-05');
    expect(r.feed).toMatchObject({ attempts: 48, succeeded: 25, failureReasons: { 'HTTP 429': 20, timeout: 2, unknown: 1 }, snapshotsStored: 52, lastSnapshotAt: '2026-11-05T14:56:00.000Z' });
  });

  it('reports the market report for the session, or that it is missing, or that there is no session', async () => {
    expect((await make([]).svc.build(day, now, '2026-11-05')).marketReport).toEqual({ sessionYmd: '2026-11-05', exists: true, status: 'published', aiGenerated: true, model: 'haiku' });
    expect((await make([], null).svc.build(day, now, '2026-11-05')).marketReport).toMatchObject({ exists: false, status: null });
    expect((await make([]).svc.build(day, now, null)).marketReport).toEqual({ sessionYmd: null, exists: false, status: null, aiGenerated: null, model: null });
  });

  it('totals the AI usage for the day and asks Brevo about exactly that day', async () => {
    const { svc, brevo, aiUsage } = make([]);
    const r = await svc.build(day, now, '2026-11-05');
    expect(aiUsage.summary).toHaveBeenCalledWith(day.start, day.end);
    expect(r.ai).toMatchObject({ calls: 3, failed: 1, unverified: 1, costUsd: 0.002 });
    expect(brevo.getEmailStats).toHaveBeenCalledWith('2026-11-05', '2026-11-05');
    expect(brevo.getCampaignStats).toHaveBeenCalledWith(day.start.toISOString(), day.end.toISOString());
  });
});

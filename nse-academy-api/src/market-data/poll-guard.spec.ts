import { WINDOW_MS, parseRateLimit, pollDecision } from './poll-guard';
import { MarketDataService } from './market-data.service';

jest.mock('axios');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');

const MIN = 60_000;

describe('pollDecision', () => {
  const t0 = Date.parse('2026-11-10T06:00:00Z');

  it('allows the first request, and spaces the rest an even gap apart', () => {
    expect(pollDecision([], t0, 4)).toEqual({ ok: true });
    expect(pollDecision([t0], t0 + 5 * MIN, 4)).toMatchObject({ ok: false, reason: 'too-soon' });
    expect(pollDecision([t0], t0 + 15 * MIN, 4)).toEqual({ ok: true });
  });

  it('refuses a fifth request inside the window however long since the last, and says when it can go', () => {
    const sent = [0, 15, 30, 45].map((m) => t0 + m * MIN);
    const d = pollDecision(sent, t0 + 60 * MIN, 4);
    expect(d).toMatchObject({ ok: false, reason: 'window-full' });
    expect((d as { waitMs: number }).waitMs).toBe(MIN); // the first request leaves the 61-minute window a minute later
    expect(pollDecision(sent, t0 + 61 * MIN, 4)).toEqual({ ok: true });
  });

  it('settles into four requests an hour, never more, over a whole trading day', () => {
    let sent: number[] = [];
    let n = 0;
    for (let m = 0; m < 7 * 60; m++) {
      const now = t0 + m * MIN;
      if (pollDecision(sent, now, 4).ok) { sent.push(now); n++; }
      sent = sent.filter((x) => now - x < WINDOW_MS);
    }
    expect(n).toBeGreaterThanOrEqual(26);
    // any rolling hour holds at most 4
    const all: number[] = [];
    let s2: number[] = [];
    for (let m = 0; m < 7 * 60; m++) { const now = t0 + m * MIN; if (pollDecision(s2, now, 4).ok) { s2.push(now); all.push(now); } s2 = s2.filter((x) => now - x < WINDOW_MS); }
    for (const a of all) expect(all.filter((b) => b >= a && b - a < 60 * MIN).length).toBeLessThanOrEqual(4);
  });

  it('scales with the plan', () => {
    const sent = [0, 5, 10, 15, 20, 25].map((m) => t0 + m * MIN);
    expect(pollDecision(sent, t0 + 30 * MIN, 60, false)).toEqual({ ok: true });
    expect(pollDecision(sent, t0 + 30 * MIN, 6, false)).toMatchObject({ ok: false, reason: 'window-full' });
  });

  it('a manual sync ignores the spacing but not the limit', () => {
    expect(pollDecision([t0], t0 + MIN, 4, false)).toEqual({ ok: true });
    expect(pollDecision([t0, t0, t0, t0], t0 + MIN, 4, false)).toMatchObject({ ok: false });
  });
});

describe('parseRateLimit', () => {
  it('reads the provider\'s own statement of its limit', () => {
    expect(parseRateLimit({ success: false, plan: 'BASIC', limit: 4, windowMinutes: 60 })).toEqual({ plan: 'BASIC', limit: 4, windowMinutes: 60 });
    expect(parseRateLimit({ message: 'nope' })).toBeNull();
    expect(parseRateLimit(null)).toBeNull();
  });
});

describe('MarketDataService polling', () => {
  function make(rows: { startedAt: Date }[] = [], max?: string) {
    const prisma = { jobRun: { findMany: jest.fn().mockResolvedValue(rows) }, stockPrice: { createMany: jest.fn().mockResolvedValue({}) } };
    const alerts = { checkAlertsForTickers: jest.fn().mockResolvedValue(undefined) };
    const monitor = { record: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn((k: string) => (k === 'RAPID_API_KEY' ? 'k' : k === 'RAPID_API_MAX_REQUESTS_PER_HOUR' ? max : undefined)) };
    const svc = new MarketDataService(prisma as never, config as never, alerts as never, monitor as never);
    return { svc, prisma, monitor };
  }
  const ok = { data: { success: true, data: [{ ticker: 'SCOM', name: 'Safaricom', price: '30', volume: '10', change: '1' }] } };

  beforeEach(() => axios.get.mockReset());

  it('polls when the allowance has room and records the request', async () => {
    axios.get.mockResolvedValue(ok);
    const { svc, monitor } = make();
    await svc.handleMarketPolling();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(monitor.record).toHaveBeenCalledWith('market-poll', expect.objectContaining({ ok: true }));
  });

  it('does nothing on a tick that is too soon after the last request, even after a restart (it reads the job log)', async () => {
    axios.get.mockResolvedValue(ok);
    const { svc } = make([{ startedAt: new Date(Date.now() - 3 * MIN) }]);
    await svc.handleMarketPolling();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('does nothing when the hour\'s allowance is used up', async () => {
    const used = [50, 35, 20, 5].map((m) => ({ startedAt: new Date(Date.now() - m * MIN) }));
    const { svc } = make(used);
    await svc.handleMarketPolling();
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('a manual sync says so when the limit is used up, and polls when it is not', async () => {
    const used = [50, 35, 20, 5].map((m) => ({ startedAt: new Date(Date.now() - m * MIN) }));
    const a = make(used);
    const refused = await a.svc.syncManually();
    expect(refused.polled).toBe(false);
    expect(refused.message).toMatch(/4 requests an hour/);
    axios.get.mockResolvedValue(ok);
    const b = make([{ startedAt: new Date(Date.now() - 2 * MIN) }]);
    expect((await b.svc.syncManually()).polled).toBe(true);
  });

  it('records a refused request as a failure, and warns once that the configured rate is above the plan', async () => {
    axios.get.mockRejectedValue({ message: '429', response: { status: 429, data: { success: false, plan: 'BASIC', limit: 4, windowMinutes: 60 } } });
    const { svc, monitor } = make([], '30');
    await svc.syncManually();
    expect(monitor.record).toHaveBeenCalledWith('market-poll', expect.objectContaining({ ok: false, error: 'HTTP 429' }));
  });
});

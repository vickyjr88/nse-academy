import { JOB_SPECS, JobSpec, JobStats, evaluateJob, expectedWindowHours } from './job-specs';

const daily: JobSpec = { name: 'd', label: 'D', schedule: 'daily', cadence: 'daily' };
const weekday: JobSpec = { name: 'w', label: 'W', schedule: 'weekdays', cadence: 'weekdays' };
const hoursAgo = (now: Date, h: number) => new Date(now.getTime() - h * 3_600_000);
const stats = (over: Partial<JobStats> = {}): JobStats => ({ lastRun: null, lastSuccess: null, runs24h: 0, failures24h: 0, ...over });
const run = (at: Date, ok = true, extra: { error?: string; summary?: string } = {}) => ({ ok, startedAt: at, durationMs: 100, summary: extra.summary ?? null, error: extra.error ?? null });

const THU = new Date('2026-11-05T10:00:00Z'); // Thursday
const MON = new Date('2026-11-09T10:00:00Z');
const long = new Date('2026-10-01T00:00:00Z'); // monitoring has been running for weeks

describe('expectedWindowHours', () => {
  it('daily jobs must have succeeded within 26 hours; weekday jobs get the weekend off', () => {
    expect(expectedWindowHours('daily', THU)).toBe(26);
    expect(expectedWindowHours('weekdays', THU)).toBe(26);
    expect(expectedWindowHours('weekdays', MON)).toBe(74);
    expect(expectedWindowHours('weekdays', new Date('2026-11-07T10:00:00Z'))).toBe(74); // Saturday
    expect(expectedWindowHours('daily', MON)).toBe(26);
  });
});

describe('evaluateJob', () => {
  it('is ok after a recent success', () => {
    const h = evaluateJob(daily, stats({ lastRun: run(hoursAgo(THU, 5)), lastSuccess: hoursAgo(THU, 5), runs24h: 1 }), THU, long);
    expect(h).toMatchObject({ status: 'ok', problem: null, runs24h: 1 });
  });

  it('is failing when the most recent run failed, even if an earlier one succeeded, and says why', () => {
    const h = evaluateJob(daily, stats({ lastRun: run(hoursAgo(THU, 1), false, { error: 'HTTP 429' }), lastSuccess: hoursAgo(THU, 20), failures24h: 1, runs24h: 2 }), THU, long);
    expect(h.status).toBe('failing');
    expect(h.problem).toContain('HTTP 429');
    expect(h.lastError).toBe('HTTP 429');
  });

  it('is overdue when the last success is older than the window, naming when it last worked', () => {
    const h = evaluateJob(daily, stats({ lastRun: run(hoursAgo(THU, 40)), lastSuccess: hoursAgo(THU, 40) }), THU, long);
    expect(h.status).toBe('overdue');
    expect(h.problem).toMatch(/No successful run since 2026-11-0\d/);
  });

  it('is overdue, with a different message, if it has never succeeded since monitoring began', () => {
    const h = evaluateJob(daily, stats(), THU, long);
    expect(h.status).toBe('overdue');
    expect(h.problem).toContain('never completed successfully');
  });

  it('is no-data, not overdue, while monitoring itself is too new to have expected a run', () => {
    expect(evaluateJob(daily, stats(), THU, hoursAgo(THU, 5)).status).toBe('no-data');
    expect(evaluateJob(daily, stats(), THU, null).status).toBe('no-data');
  });

  it('does not call a weekday job overdue over a weekend, but does on a Tuesday', () => {
    const fri = new Date('2026-11-06T19:00:00Z');
    expect(evaluateJob(weekday, stats({ lastRun: run(fri), lastSuccess: fri }), MON, long).status).toBe('ok'); // 63 h later, Monday morning
    const tue = new Date('2026-11-10T10:00:00Z');
    expect(evaluateJob(weekday, stats({ lastRun: run(fri), lastSuccess: fri }), tue, long).status).toBe('overdue');
  });
});

describe('JOB_SPECS', () => {
  it('has unique names and covers the scheduled jobs the system runs', () => {
    const names = JOB_SPECS.map((j) => j.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of ['market-poll', 'daily-admin-report', 'market-report', 'portfolio-watch', 'subscription-expiry', 'lifecycle-winback', 'referral-nudge']) expect(names).toContain(n);
  });
});

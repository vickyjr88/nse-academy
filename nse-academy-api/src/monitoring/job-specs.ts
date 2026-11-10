// What the system is supposed to be doing in the background, and how to tell whether it is. The names are the ones the
// instrumented services record under (JobMonitorService.track / record).

export type Cadence = 'daily' | 'weekdays' | 'frequent';

export interface JobSpec {
  name: string;
  label: string;
  /** Human-readable schedule, as shown in the admin. */
  schedule: string;
  cadence: Cadence;
}

export const JOB_SPECS: JobSpec[] = [
  { name: 'market-poll', label: 'Market price feed', schedule: 'every 7 min, 09:00-15:00 UTC, Mon-Fri', cadence: 'frequent' },
  { name: 'daily-admin-report', label: 'Daily admin report', schedule: '08:00 Nairobi daily', cadence: 'daily' },
  { name: 'market-report', label: 'Public market report', schedule: '21:00 Nairobi, Mon-Fri', cadence: 'weekdays' },
  { name: 'market-digest', label: 'Evening market digest emails', schedule: '21:20 Nairobi, Mon-Fri', cadence: 'weekdays' },
  { name: 'portfolio-watch', label: 'Portfolio watch emails', schedule: '16:30 Nairobi, Mon-Fri', cadence: 'weekdays' },
  { name: 'subscription-expiry', label: 'Expire lapsed subscriptions', schedule: '06:00 UTC daily', cadence: 'daily' },
  { name: 'subscription-expiring-soon', label: 'Expiring-soon reminders', schedule: '07:00 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-day1-nurture', label: 'Lifecycle: day 1 welcome', schedule: '08:00 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-day7-nurture', label: 'Lifecycle: day 7 re-engagement', schedule: '08:00 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-day14-nurture', label: 'Lifecycle: day 14 upgrade pitch', schedule: '08:00 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-engaged-free-tagging', label: 'Lifecycle: tag engaged free users', schedule: '08:30 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-active-trader-tagging', label: 'Lifecycle: tag active traders', schedule: '08:35 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-corporate-expiring', label: 'Lifecycle: corporate licence expiring', schedule: '09:00 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-renewal-nudge', label: 'Lifecycle: renewal nudge', schedule: '10:00 UTC daily', cadence: 'daily' },
  { name: 'lifecycle-winback', label: 'Lifecycle: win-back', schedule: '10:00 UTC daily', cadence: 'daily' },
  { name: 'referral-nudge', label: 'Stale referral nudge', schedule: '11:00 UTC daily', cadence: 'daily' },
];

export type JobStatus = 'ok' | 'overdue' | 'failing' | 'no-data';

export interface JobStats {
  lastRun: { ok: boolean; startedAt: Date; durationMs: number | null; summary: string | null; error: string | null } | null;
  lastSuccess: Date | null;
  runs24h: number;
  failures24h: number;
}

export interface JobHealth extends JobSpec {
  status: JobStatus;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastSummary: string | null;
  lastError: string | null;
  runs24h: number;
  failures24h: number;
  /** Why it is not "ok", in words an admin can act on. */
  problem: string | null;
}

const HOUR = 3_600_000;

/** How far back a successful run must be for the job to count as on time. Weekday-only jobs get the weekend off. */
export function expectedWindowHours(cadence: Cadence, now: Date): number {
  if (cadence === 'daily') return 26;
  const dow = now.getUTCDay(); // 0 Sun ... 6 Sat
  return dow === 0 || dow === 1 || dow === 6 ? 74 : 26;
}

/**
 * Pure verdict for one job. `monitorSince` is when the first job run of any kind was ever recorded: a job cannot be
 * called overdue before monitoring had been running long enough for it to have run.
 */
export function evaluateJob(spec: JobSpec, stats: JobStats, now: Date, monitorSince: Date | null): JobHealth {
  const base: JobHealth = {
    ...spec,
    status: 'ok',
    lastRunAt: stats.lastRun?.startedAt ?? null,
    lastSuccessAt: stats.lastSuccess,
    lastSummary: stats.lastRun?.summary ?? null,
    lastError: stats.lastRun?.error ?? null,
    runs24h: stats.runs24h,
    failures24h: stats.failures24h,
    problem: null,
  };

  if (stats.lastRun && !stats.lastRun.ok) {
    return { ...base, status: 'failing', problem: `The last run failed${stats.lastRun.error ? `: ${stats.lastRun.error}` : ''}.` };
  }

  const windowMs = expectedWindowHours(spec.cadence, now) * HOUR;
  const recentSuccess = stats.lastSuccess && now.getTime() - stats.lastSuccess.getTime() <= windowMs;
  if (recentSuccess) return base;

  const monitoredLongEnough = monitorSince !== null && now.getTime() - monitorSince.getTime() > windowMs;
  if (!monitoredLongEnough) return { ...base, status: 'no-data', problem: 'Monitoring only just started; this job has not had a chance to run yet.' };

  return {
    ...base,
    status: 'overdue',
    problem: stats.lastSuccess
      ? `No successful run since ${stats.lastSuccess.toISOString().slice(0, 16).replace('T', ' ')} UTC.`
      : 'It has never completed successfully since monitoring began.',
  };
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JOB_SPECS, JobHealth, JobStats, evaluateJob } from './job-specs';

const SUMMARY_MAX = 300;
const trim = (s: string | undefined | null) => (s ? s.slice(0, SUMMARY_MAX) : undefined);

/**
 * Records every scheduled-job run so "did it run, and did it work?" has an answer. Monitoring must never be the thing
 * that breaks a job, so recording failures are logged and swallowed.
 */
@Injectable()
export class JobMonitorService {
  private readonly logger = new Logger(JobMonitorService.name);

  constructor(private prisma: PrismaService) {}

  /** Runs `fn`, records the outcome, and returns/throws exactly what `fn` did. `summarize` turns a result into a one-liner. */
  async track<T>(job: string, fn: () => Promise<T>, summarize?: (result: T) => string | undefined): Promise<T> {
    const startedAt = new Date();
    try {
      const result = await fn();
      await this.record(job, { ok: true, startedAt, summary: summarize ? safe(() => summarize(result)) : undefined });
      return result;
    } catch (err) {
      await this.record(job, { ok: false, startedAt, error: (err as Error).message });
      throw err;
    }
  }

  async record(job: string, run: { ok: boolean; startedAt?: Date; summary?: string; error?: string }): Promise<void> {
    const startedAt = run.startedAt ?? new Date();
    const finishedAt = new Date();
    try {
      await this.prisma.jobRun.create({
        data: { job, startedAt, finishedAt, ok: run.ok, durationMs: finishedAt.getTime() - startedAt.getTime(), summary: trim(run.summary), error: trim(run.error) },
      });
    } catch (err) {
      this.logger.warn(`Could not record a run of ${job}: ${(err as Error).message}`);
    }
  }

  async recent(job: string | undefined, limit = 50) {
    return this.prisma.jobRun.findMany({ where: job ? { job } : {}, orderBy: { startedAt: 'desc' }, take: Math.min(Math.max(limit, 1), 200) });
  }

  async monitorSince(): Promise<Date | null> {
    const first = await this.prisma.jobRun.findFirst({ orderBy: { startedAt: 'asc' }, select: { startedAt: true } });
    return first?.startedAt ?? null;
  }

  async stats(job: string, now: Date): Promise<JobStats> {
    const since = new Date(now.getTime() - 24 * 3_600_000);
    const [lastRun, lastSuccess, runs24h, failures24h] = await Promise.all([
      this.prisma.jobRun.findFirst({ where: { job }, orderBy: { startedAt: 'desc' } }),
      this.prisma.jobRun.findFirst({ where: { job, ok: true }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
      this.prisma.jobRun.count({ where: { job, startedAt: { gte: since } } }),
      this.prisma.jobRun.count({ where: { job, ok: false, startedAt: { gte: since } } }),
    ]);
    return {
      lastRun: lastRun && { ok: lastRun.ok, startedAt: lastRun.startedAt, durationMs: lastRun.durationMs, summary: lastRun.summary, error: lastRun.error },
      lastSuccess: lastSuccess?.startedAt ?? null,
      runs24h,
      failures24h,
    };
  }

  /** The verdict for every job the system is meant to run. */
  async health(now = new Date()): Promise<JobHealth[]> {
    const since = await this.monitorSince();
    return Promise.all(JOB_SPECS.map(async (spec) => evaluateJob(spec, await this.stats(spec.name, now), now, since)));
  }

  /** Keeps the table small: the market poll alone writes dozens of rows a day. */
  async prune(keepDays = 90): Promise<number> {
    const { count } = await this.prisma.jobRun.deleteMany({ where: { startedAt: { lt: new Date(Date.now() - keepDays * 86_400_000) } } });
    return count;
  }
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

import { JobMonitorService } from './job-monitor.service';

/** Runs `fn` under the job monitor when there is one (tests and scripts that build a service by hand have none). */
export function tracked<T>(monitor: JobMonitorService | undefined, job: string, fn: () => Promise<T>, summarize?: (r: T) => string | undefined): Promise<T> {
  return monitor ? monitor.track(job, fn, summarize) : fn();
}

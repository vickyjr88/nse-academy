// The judgement calls of the daily report - what deserves the admin's attention - kept pure so they can be tested.

import { escapeHtml } from '../brevo/email-template';
import { BusinessMetrics } from './business-metrics.service';
import { EXPECTED_POLLS_PER_DAY, SystemReport } from './system-health.service';

export const FEED_MIN_SUCCESS_RATE = 0.7;
export const AI_MIN_VERIFIED_RATE = 0.6;
export const EMAIL_MAX_BOUNCE_RATE = 0.05;

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

/** Names for an alert line: the first few, then "and N more", so one bad night cannot bury the other alerts. */
export function nameList(names: string[], max = 4): string {
  const shown = names.slice(0, max).map(escapeHtml).join('; ');
  return names.length > max ? `${shown}; and ${names.length - max} more (see System health below)` : shown;
}

export function feedSuccessRate(f: SystemReport['feed']): number | null {
  return f.attempts > 0 ? f.succeeded / f.attempts : null;
}

export function emailBounceRate(e: NonNullable<SystemReport['email']>): number {
  return e.requests > 0 ? (e.hardBounces + e.softBounces + e.blocked + e.invalid) / e.requests : 0;
}

/** Things that need a human, as ready-to-render HTML lines. `isTradingDay` stops weekends being flagged for silence. */
export function systemAttention(system: SystemReport, isTradingDay: boolean): string[] {
  const out: string[] = [];

  const failing = system.jobs.filter((j) => j.status === 'failing');
  if (failing.length) {
    out.push(`<strong>${failing.length} scheduled job${failing.length === 1 ? ' is' : 's are'} failing:</strong> ${nameList(failing.map((j) => `${j.label}${j.lastError ? ` (${j.lastError.slice(0, 80)})` : ''}`))}.`);
  }
  const overdue = system.jobs.filter((j) => j.status === 'overdue');
  if (overdue.length) {
    out.push(`<strong>${overdue.length} scheduled job${overdue.length === 1 ? ' has' : 's have'} not run when expected:</strong> ${nameList(overdue.map((j) => j.label))}.`);
  }

  const rate = feedSuccessRate(system.feed);
  if (isTradingDay) {
    if (system.feed.attempts === 0 && system.jobs.find((j) => j.name === 'market-poll')?.status !== 'no-data') {
      out.push('<strong>The market price feed made no attempts</strong> on this trading day.');
    } else if (rate !== null && rate < FEED_MIN_SUCCESS_RATE) {
      const top = Object.entries(system.feed.failureReasons).sort((a, b) => b[1] - a[1])[0];
      out.push(`<strong>Only ${pct(system.feed.succeeded, system.feed.attempts)}% of market price polls succeeded</strong> (${system.feed.succeeded} of ${system.feed.attempts}${top ? `; most common failure: ${escapeHtml(top[0])}` : ''}). The data provider may be rate-limiting the key.`);
    }
  }

  const mr = system.marketReport;
  if (isTradingDay && mr.sessionYmd) {
    if (!mr.exists) out.push(`<strong>No public market report exists for ${escapeHtml(mr.sessionYmd)}.</strong>`);
    else if (mr.status !== 'published') out.push(`<strong>The market report for ${escapeHtml(mr.sessionYmd)} is ${escapeHtml(mr.status ?? 'unpublished')}</strong>, not live.`);
    else if (mr.aiGenerated === false) out.push(`<strong>The market report for ${escapeHtml(mr.sessionYmd)} used the template story</strong>, not an AI-written one: the model did not pass verification.`);
  }

  if (system.ai.calls >= 3) {
    const verifiable = system.ai.rows.reduce((n, r) => n + r.verified + r.unverified, 0);
    const verified = system.ai.rows.reduce((n, r) => n + r.verified, 0);
    if (verifiable > 0 && verified / verifiable < AI_MIN_VERIFIED_RATE) {
      out.push(`<strong>Only ${pct(verified, verifiable)}% of AI answers passed verification</strong> (${verified} of ${verifiable}). Consider a more capable model.`);
    }
  }
  if (system.ai.failed > 0) out.push(`<strong>${system.ai.failed} AI request${system.ai.failed === 1 ? '' : 's'} failed outright</strong> yesterday.`);

  if (system.email) {
    const e = system.email;
    if (e.requests >= 10 && emailBounceRate(e) > EMAIL_MAX_BOUNCE_RATE) {
      out.push(`<strong>${pct(e.hardBounces + e.softBounces + e.blocked + e.invalid, e.requests)}% of transactional email bounced or was blocked</strong> (${e.requests} sent). That hurts the sender's reputation.`);
    }
    if (e.spamReports > 0) out.push(`<strong>${e.spamReports} spam complaint${e.spamReports === 1 ? '' : 's'}</strong> on transactional email.`);
  }
  for (const c of system.campaigns) {
    if (c.sent >= 10 && c.complaints > 0) out.push(`<strong>Campaign "${escapeHtml(c.subject)}" drew ${c.complaints} spam complaint${c.complaints === 1 ? '' : 's'}.</strong>`);
  }
  return out;
}

export function businessAttention(b: BusinessMetrics): string[] {
  const out: string[] = [];
  if (b.product.statementsFailed > 0) {
    out.push(`<strong>${b.product.statementsFailed} CDSC statement import${b.product.statementsFailed === 1 ? '' : 's'} failed</strong> yesterday - those members could not load their portfolio.`);
  }
  if (b.churn.expiringNext7 > 0 && b.recurring.activePaid > 0 && b.churn.expiringNext7 / b.recurring.activePaid >= 0.5) {
    out.push(`<strong>${b.churn.expiringNext7} of ${b.recurring.activePaid} paying members renew within 7 days</strong> - a renewal push now protects most of your recurring revenue.`);
  }
  return out;
}

export function conversionPct(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '-';
}

export function trendNote(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'flat' : 'new this week';
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? '+' : ''}${change}% on the week before`;
}

export { EXPECTED_POLLS_PER_DAY };

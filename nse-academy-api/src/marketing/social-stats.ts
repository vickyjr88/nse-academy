import { dayRange, eatDay } from '../admin-ops/admin-metrics.service';

const DAY_MS = 86_400_000;

export interface PostRow {
  platform: string;
  status: string;
  publishedAt: Date;
}

export interface PlatformStats {
  platform: string;
  published: number;
  failed: number;
  draft: number;
  /** Published as a share of published + failed, in percent. Null when nothing was attempted. */
  successRate: number | null;
  lastPublishedAt: string | null;
}

export interface SocialSummary {
  days: number;
  byDay: { day: string; published: number; failed: number; draft: number }[];
  byPlatform: PlatformStats[];
  totals: { published: number; failed: number; draft: number; successRate: number | null };
  /** The same count for the period just before, so the page can show a change. */
  previous: { published: number; failed: number };
}

export const successRate = (published: number, failed: number): number | null =>
  published + failed > 0 ? Math.round((published / (published + failed)) * 100) : null;

/**
 * Post counts for the last `days` Nairobi days, by day and by platform, plus the previous period's totals.
 * `platformIds` keeps a platform with no posts in the list instead of dropping it.
 */
export function summarizePosts(rows: PostRow[], now: Date, days: number, platformIds: string[] = []): SocialSummary {
  const range = dayRange(now, days);
  const earlier = new Set(dayRange(new Date(now.getTime() - days * DAY_MS), days));
  const inRange = new Set(range);

  const byDay = new Map(range.map((day) => [day, { day, published: 0, failed: 0, draft: 0 }]));
  const byPlatform = new Map<string, { published: number; failed: number; draft: number; last: Date | null }>(
    platformIds.map((id) => [id, { published: 0, failed: 0, draft: 0, last: null }]),
  );
  const previous = { published: 0, failed: 0 };

  for (const row of rows) {
    const day = eatDay(row.publishedAt);
    const kind = row.status === 'published' ? 'published' : row.status === 'failed' ? 'failed' : row.status === 'draft' ? 'draft' : null;
    if (!kind) continue;

    if (earlier.has(day)) {
      if (kind !== 'draft') previous[kind] += 1;
      continue;
    }
    if (!inRange.has(day)) continue;

    byDay.get(day)![kind] += 1;
    const p = byPlatform.get(row.platform) ?? { published: 0, failed: 0, draft: 0, last: null };
    p[kind] += 1;
    if (kind === 'published' && (!p.last || row.publishedAt > p.last)) p.last = row.publishedAt;
    byPlatform.set(row.platform, p);
  }

  const dayRows = [...byDay.values()];
  const published = dayRows.reduce((s, d) => s + d.published, 0);
  const failed = dayRows.reduce((s, d) => s + d.failed, 0);
  const draft = dayRows.reduce((s, d) => s + d.draft, 0);

  return {
    days,
    byDay: dayRows,
    byPlatform: [...byPlatform.entries()].map(([platform, p]) => ({
      platform,
      published: p.published,
      failed: p.failed,
      draft: p.draft,
      successRate: successRate(p.published, p.failed),
      lastPublishedAt: p.last ? p.last.toISOString() : null,
    })),
    totals: { published, failed, draft, successRate: successRate(published, failed) },
    previous,
  };
}

// ---- account health -----------------------------------------------------------------------------------------------

export type HealthState = 'paused' | 'expired' | 'expiring' | 'untested' | 'ok';

export interface HealthInput {
  platform: string;
  isActive: boolean;
  expiresAt: Date | null;
  lastTestedAt: Date | null;
  hasRefreshToken?: boolean;
}

export interface AccountHealth {
  state: HealthState;
  /** Whole days until the token ends, when it has an end date that is not renewed automatically. */
  daysLeft: number | null;
}

/** Days a token may be overdue before an automatic renewal is considered to have failed. */
const RENEWAL_GRACE_DAYS = 2;
const WARN_DAYS = 7;

/**
 * What the admin should know about an account at a glance. Threads tokens and TikTok tokens that come with a refresh token
 * renew themselves, so an end date alone is not a warning: only a token that stayed expired past the grace period is.
 */
export function accountHealth(a: HealthInput, now: Date): AccountHealth {
  if (!a.isActive) return { state: 'paused', daysLeft: null };

  const renews = a.platform === 'threads' || (a.platform === 'tiktok' && !!a.hasRefreshToken);
  if (a.expiresAt) {
    const daysLeft = Math.ceil((a.expiresAt.getTime() - now.getTime()) / DAY_MS);
    if (renews) {
      if (daysLeft < -RENEWAL_GRACE_DAYS) return { state: 'expired', daysLeft };
    } else if (daysLeft <= 0) {
      return { state: 'expired', daysLeft };
    } else if (daysLeft <= WARN_DAYS) {
      return { state: 'expiring', daysLeft };
    }
  }
  if (!a.lastTestedAt) return { state: 'untested', daysLeft: null };
  return { state: 'ok', daysLeft: null };
}

// ---- history filters ----------------------------------------------------------------------------------------------

export interface HistoryFilters {
  platform?: string;
  credentialId?: string;
  status?: string;
  /** ISO time: only posts older than this, for "load more". */
  before?: string;
  /** Text to look for in the post or its error. */
  q?: string;
}

const STATUSES = ['published', 'draft', 'failed'];

/** The Prisma `where` for the history list. Unknown statuses and unreadable dates are ignored rather than guessed at. */
export function historyWhere(f: HistoryFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (f.platform) where.platform = f.platform;
  if (f.credentialId) where.credentialId = f.credentialId;
  if (f.status && STATUSES.includes(f.status)) where.status = f.status;
  if (f.before) {
    const d = new Date(f.before);
    if (!Number.isNaN(d.getTime())) where.publishedAt = { lt: d };
  }
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { content: { contains: q.slice(0, 100), mode: 'insensitive' } },
      { error: { contains: q.slice(0, 100), mode: 'insensitive' } },
    ];
  }
  return where;
}

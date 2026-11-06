import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** A member is recorded at most this often; an active session makes dozens of requests a minute. */
const THROTTLE_MS = 10 * 60_000;
const EAT_OFFSET_MS = 3 * 3_600_000;
const MAX_REMEMBERED = 5000;

/** The Nairobi calendar date (YYYY-MM-DD) of an instant. */
export const nairobiYmd = (d: Date): string => new Date(d.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);

/** The date `n` days before a YYYY-MM-DD date. */
export const ymdMinus = (ymd: string, n: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

export interface ActivityMetrics {
  /** First day any activity was recorded; null until the first member uses the app after this shipped. */
  trackingSince: string | null;
  trackingDays: number;
  dau: number;
  wau: number;
  mau: number;
  /** DAU as a share of MAU: how often monthly users come back. */
  stickinessPct: number | null;
  /** Paying members with no activity in `dormantDays` days; null while tracking is younger than that (it would be a guess). */
  dormantPaying: { userId: string; name: string; email: string; tier: string; lastActiveAt: string | null; endsOn: string | null }[] | null;
  dormantDays: number;
  series: { day: string; count: number }[];
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private readonly seen = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  /** Called for every authenticated request. Cheap: most calls return from memory without touching the database. */
  async touch(userId: string, now = new Date()): Promise<void> {
    const last = this.seen.get(userId);
    if (last !== undefined && now.getTime() - last < THROTTLE_MS) return;
    if (this.seen.size >= MAX_REMEMBERED) this.seen.clear();
    this.seen.set(userId, now.getTime());
    const day = nairobiYmd(now);
    try {
      await this.prisma.$transaction([
        this.prisma.activityDay.upsert({
          where: { userId_day: { userId, day } },
          create: { userId, day, firstSeenAt: now, lastSeenAt: now },
          update: { lastSeenAt: now, hits: { increment: 1 } },
        }),
        this.prisma.user.update({ where: { id: userId }, data: { lastActiveAt: now } }),
      ]);
    } catch (err) {
      // Forget it so the next request retries; activity tracking must never fail a request.
      this.seen.delete(userId);
      this.logger.warn(`Could not record activity for ${userId}: ${(err as Error).message}`);
    }
  }

  /** A password sign-in: also counts as activity for the day. */
  async recordLogin(userId: string, now = new Date()): Promise<void> {
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: now } });
    } catch (err) {
      this.logger.warn(`Could not record login for ${userId}: ${(err as Error).message}`);
    }
    this.seen.delete(userId); // a fresh sign-in should always register on today's row
    await this.touch(userId, now);
  }

  /** Active-member figures as of the end of Nairobi day `ymd`. */
  async metrics(ymd: string, opts: { dormantDays?: number; seriesDays?: number } = {}): Promise<ActivityMetrics> {
    const dormantDays = opts.dormantDays ?? 14;
    const seriesDays = opts.seriesDays ?? 30;
    const distinctUsers = async (from: string) => (await this.prisma.activityDay.groupBy({ by: ['userId'], where: { day: { gte: from, lte: ymd } } })).length;

    const [first, dau, wau, mau, seriesRows] = await Promise.all([
      this.prisma.activityDay.aggregate({ _min: { day: true } }),
      this.prisma.activityDay.count({ where: { day: ymd } }),
      distinctUsers(ymdMinus(ymd, 6)),
      distinctUsers(ymdMinus(ymd, 29)),
      this.prisma.activityDay.groupBy({ by: ['day'], where: { day: { gte: ymdMinus(ymd, seriesDays - 1), lte: ymd } }, _count: { _all: true } }),
    ]);

    const trackingSince = first._min.day ?? null;
    const trackingDays = trackingSince ? Math.floor((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${trackingSince}T00:00:00Z`)) / 86_400_000) + 1 : 0;

    let dormantPaying: ActivityMetrics['dormantPaying'] = null;
    if (trackingDays >= dormantDays) {
      const since = ymdMinus(ymd, dormantDays - 1);
      const rows = await this.prisma.subscription.findMany({
        where: { status: 'active', tier: { in: ['intermediary', 'premium'] }, user: { activityDays: { none: { day: { gte: since } } } } },
        orderBy: { currentPeriodEnd: 'asc' },
        take: 25,
        select: { tier: true, currentPeriodEnd: true, user: { select: { id: true, name: true, email: true, lastActiveAt: true } } },
      });
      dormantPaying = rows.map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        email: r.user.email,
        tier: r.tier,
        lastActiveAt: r.user.lastActiveAt ? r.user.lastActiveAt.toISOString() : null,
        endsOn: r.currentPeriodEnd ? r.currentPeriodEnd.toISOString().slice(0, 10) : null,
      }));
    }

    const byDay = new Map(seriesRows.map((r) => [r.day, r._count._all]));
    const series = Array.from({ length: seriesDays }, (_, i) => {
      const day = ymdMinus(ymd, seriesDays - 1 - i);
      return { day, count: byDay.get(day) ?? 0 };
    });

    return { trackingSince, trackingDays, dau, wau, mau, stickinessPct: mau > 0 ? Math.round((dau / mau) * 100) : null, dormantPaying, dormantDays, series };
  }
}

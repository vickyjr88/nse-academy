import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Device } from './track-rules';

export interface PageViewInput {
  visitorId: string;
  path: string;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: Device;
}

export interface TrafficWindow {
  pageViews: number;
  visitors: number;
  topPages: { path: string; views: number; visitors: number }[];
  sources: { source: string; views: number; visitors: number }[];
  campaigns: { campaign: string; views: number; visitors: number }[];
  devices: { device: string; views: number }[];
  signups: { source: string; signups: number; paying: number }[];
}

export interface TrafficReport extends TrafficWindow {
  days: number;
  from: string;
  to: string;
  previous: { pageViews: number; visitors: number };
  series: { day: string; views: number; visitors: number }[];
}

const num = (v: unknown) => Number(v ?? 0);

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /** Never throws: tracking must not be able to affect a visitor. */
  async record(v: PageViewInput): Promise<void> {
    try {
      await this.prisma.pageView.create({ data: v });
    } catch (err) {
      this.logger.warn(`Could not record a page view: ${(err as Error).message}`);
    }
  }

  /** Totals, top pages, sources, campaigns, devices and attributed signups between two instants. */
  async window(from: Date, to: Date): Promise<TrafficWindow> {
    const [totals, pages, sources, campaigns, devices, signups] = await Promise.all([
      this.prisma.$queryRaw<{ views: bigint; visitors: bigint }[]>(Prisma.sql`select count(*) as views, count(distinct "visitorId") as visitors from "PageView" where "at" >= ${from} and "at" < ${to}`),
      this.prisma.$queryRaw<{ path: string; views: bigint; visitors: bigint }[]>(Prisma.sql`select "path", count(*) as views, count(distinct "visitorId") as visitors from "PageView" where "at" >= ${from} and "at" < ${to} group by "path" order by views desc limit 10`),
      this.prisma.$queryRaw<{ source: string; views: bigint; visitors: bigint }[]>(Prisma.sql`select coalesce("utmSource", "referrerHost", 'direct') as source, count(*) as views, count(distinct "visitorId") as visitors from "PageView" where "at" >= ${from} and "at" < ${to} group by 1 order by views desc limit 10`),
      this.prisma.$queryRaw<{ campaign: string; views: bigint; visitors: bigint }[]>(Prisma.sql`select "utmCampaign" as campaign, count(*) as views, count(distinct "visitorId") as visitors from "PageView" where "at" >= ${from} and "at" < ${to} and "utmCampaign" is not null group by 1 order by views desc limit 10`),
      this.prisma.$queryRaw<{ device: string; views: bigint }[]>(Prisma.sql`select "device", count(*) as views from "PageView" where "at" >= ${from} and "at" < ${to} group by 1 order by views desc`),
      this.prisma.$queryRaw<{ source: string; signups: bigint; paying: bigint }[]>(Prisma.sql`
        select coalesce(a."utmSource", a."referrerHost", 'direct') as source, count(*) as signups,
               count(*) filter (where s."tier" in ('intermediary','premium') and s."status" = 'active') as paying
        from "SignupAttribution" a left join "Subscription" s on s."userId" = a."userId"
        where a."createdAt" >= ${from} and a."createdAt" < ${to} group by 1 order by signups desc limit 10`),
    ]);
    return {
      pageViews: num(totals[0]?.views),
      visitors: num(totals[0]?.visitors),
      topPages: pages.map((r) => ({ path: r.path, views: num(r.views), visitors: num(r.visitors) })),
      sources: sources.map((r) => ({ source: r.source, views: num(r.views), visitors: num(r.visitors) })),
      campaigns: campaigns.map((r) => ({ campaign: r.campaign, views: num(r.views), visitors: num(r.visitors) })),
      devices: devices.map((r) => ({ device: r.device, views: num(r.views) })),
      signups: signups.map((r) => ({ source: r.source, signups: num(r.signups), paying: num(r.paying) })),
    };
  }

  /** The admin's traffic page: the last `days` days, compared with the same length before, with a per-day series (Nairobi days). */
  async report(days = 30, now = new Date()): Promise<TrafficReport> {
    const d = Math.min(Math.max(Math.floor(days) || 30, 1), 90);
    const to = now;
    const from = new Date(to.getTime() - d * 86_400_000);
    const prevFrom = new Date(from.getTime() - d * 86_400_000);
    const [current, prev, seriesRows] = await Promise.all([
      this.window(from, to),
      this.prisma.$queryRaw<{ views: bigint; visitors: bigint }[]>(Prisma.sql`select count(*) as views, count(distinct "visitorId") as visitors from "PageView" where "at" >= ${prevFrom} and "at" < ${from}`),
      this.prisma.$queryRaw<{ day: string; views: bigint; visitors: bigint }[]>(Prisma.sql`
        select to_char(("at" at time zone 'UTC') at time zone 'Africa/Nairobi', 'YYYY-MM-DD') as day, count(*) as views, count(distinct "visitorId") as visitors
        from "PageView" where "at" >= ${from} and "at" < ${to} group by 1 order by 1`),
    ]);
    const byDay = new Map(seriesRows.map((r) => [r.day, r]));
    const series = Array.from({ length: d }, (_, i) => {
      const day = new Date(to.getTime() + 3 * 3_600_000 - (d - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      const r = byDay.get(day);
      return { day, views: num(r?.views), visitors: num(r?.visitors) };
    });
    return { ...current, days: d, from: from.toISOString(), to: to.toISOString(), previous: { pageViews: num(prev[0]?.views), visitors: num(prev[0]?.visitors) }, series };
  }

  /** Stores where a new member came from. Best effort: never blocks or fails a signup. */
  async recordSignupAttribution(userId: string, a: { visitorId?: string; referrerHost?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; landingPath?: string }): Promise<void> {
    try {
      await this.prisma.signupAttribution.upsert({
        where: { userId },
        create: { userId, ...a },
        update: {},
      });
    } catch (err) {
      this.logger.warn(`Could not record signup attribution for ${userId}: ${(err as Error).message}`);
    }
  }

  async prune(keepDays = 400): Promise<number> {
    const { count } = await this.prisma.pageView.deleteMany({ where: { at: { lt: new Date(Date.now() - keepDays * 86_400_000) } } });
    return count;
  }
}

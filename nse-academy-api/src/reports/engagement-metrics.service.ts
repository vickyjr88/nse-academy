import { Injectable, Logger } from '@nestjs/common';
import { ActivityMetrics, ActivityService } from '../activity/activity.service';
import { AnalyticsService, TrafficWindow } from '../analytics/analytics.service';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { DayBounds } from './report-helpers';

const WEEK_MS = 7 * 86_400_000;

export interface EngagementMetrics {
  members: ActivityMetrics;
  traffic: {
    day: { pageViews: number; visitors: number };
    week: TrafficWindow;
    previousWeek: { pageViews: number; visitors: number };
  };
  adminChanges: Awaited<ReturnType<AdminAuditService['summary']>>;
}

@Injectable()
export class EngagementMetricsService {
  private readonly logger = new Logger(EngagementMetricsService.name);

  constructor(
    private activity: ActivityService,
    private analytics: AnalyticsService,
    private audit: AdminAuditService,
  ) {}

  async build(day: DayBounds): Promise<EngagementMetrics> {
    const weekFrom = new Date(day.end.getTime() - WEEK_MS);
    const prevFrom = new Date(weekFrom.getTime() - WEEK_MS);
    const [members, dayTraffic, week, prev, adminChanges] = await Promise.all([
      this.activity.metrics(day.ymd),
      this.analytics.window(day.start, day.end),
      this.analytics.window(weekFrom, day.end),
      this.analytics.window(prevFrom, weekFrom),
      this.audit.summary(day.start, day.end),
    ]);
    return {
      members,
      traffic: {
        day: { pageViews: dayTraffic.pageViews, visitors: dayTraffic.visitors },
        week,
        previousWeek: { pageViews: prev.pageViews, visitors: prev.visitors },
      },
      adminChanges,
    };
  }

  /** Retention for the operational tables this report reads: page views 400 days, the audit trail a year. */
  async prune(): Promise<void> {
    try {
      const [views, audit] = await Promise.all([this.analytics.prune(400), this.audit.prune(365)]);
      if (views || audit) this.logger.log(`Pruned ${views} old page views and ${audit} old audit entries`);
    } catch (err) {
      this.logger.warn(`Could not prune: ${(err as Error).message}`);
    }
  }
}

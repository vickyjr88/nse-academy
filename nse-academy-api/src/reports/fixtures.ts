import { JobHealth } from '../monitoring/job-specs';
import { BusinessMetrics } from './business-metrics.service';
import { SystemReport } from './system-health.service';

export const okJob = (name: string, label = name): JobHealth => ({
  name, label, schedule: 'daily', cadence: 'daily', status: 'ok', lastRunAt: new Date('2026-11-05T05:00:00Z'), lastSuccessAt: new Date('2026-11-05T05:00:00Z'),
  lastSummary: null, lastError: null, runs24h: 1, failures24h: 0, problem: null,
});

export const business = (over: Partial<BusinessMetrics> = {}): BusinessMetrics => ({
  revenue: { dayKes: 1425, dayPayments: 1, monthToDateKes: 6925, last30DaysKes: 6925, recordedSince: '2026-11-06' },
  recurring: { activePaid: 3, premium: 2, intermediary: 1, mrrKes: 1300, arrKes: 15600 },
  growth: { signupsDay: 3, signups7d: 14, signupsPrev7d: 10 },
  funnel: { windowDays: 30, signups: 40, profiled: 30, activated: 8, paying: 2 },
  churn: { lapsedDay: 1, lapsed30d: 4, expiringNext7: 1 },
  product: { tradesLogged: 6, statementsImported: 2, statementsFailed: 0, portfolioWatchSent: 1, alertsCreated: 3, lessonsCompleted: 9 },
  ...over,
});

export const system = (over: Partial<SystemReport> = {}): SystemReport => ({
  jobs: [okJob('market-poll', 'Market price feed'), okJob('daily-admin-report', 'Daily admin report')],
  feed: { attempts: 54, succeeded: 52, failureReasons: { 'HTTP 429': 2 }, snapshotsStored: 52, lastSnapshotAt: '2026-11-05T14:56:00.000Z' },
  marketReport: { sessionYmd: '2026-11-05', exists: true, status: 'published', aiGenerated: true, model: 'anthropic/claude-haiku-5.5' },
  ai: { rows: [{ feature: 'advisor', model: 'ling', calls: 4, failed: 0, verified: 4, unverified: 0, costUsd: 0.0021, promptTokens: 9000, completionTokens: 2000, avgSeconds: 11.2 }], calls: 4, failed: 0, unverified: 0, costUsd: 0.0021 },
  email: { requests: 120, delivered: 118, hardBounces: 1, softBounces: 1, blocked: 0, invalid: 0, spamReports: 0, unsubscribed: 0, opens: 60, clicks: 12 },
  campaigns: [],
  ...over,
});

import { EngagementMetrics } from './engagement-metrics.service';

export const engagement = (over: Partial<EngagementMetrics> = {}): EngagementMetrics => ({
  members: {
    trackingSince: '2026-10-01', trackingDays: 36, dau: 6, wau: 14, mau: 31, stickinessPct: 19, dormantDays: 14,
    dormantPaying: [], series: [],
  },
  traffic: {
    day: { pageViews: 120, visitors: 48 },
    week: {
      pageViews: 800, visitors: 310,
      topPages: [{ path: '/', views: 300, visitors: 200 }, { path: '/companies/SCOM', views: 90, visitors: 70 }],
      sources: [{ source: 'whatsapp', views: 200, visitors: 120 }, { source: 'direct', views: 150, visitors: 100 }],
      campaigns: [],
      devices: [{ device: 'mobile', views: 600 }],
      signups: [{ source: 'whatsapp', signups: 5, paying: 1 }],
    },
    previousWeek: { pageViews: 600, visitors: 250 },
  },
  adminChanges: { total: 3, failed: 0, byActor: [{ actor: 'info@vitaldigitalmedia.net', count: 3 }], recent: [{ actor: 'info@vitaldigitalmedia.net', action: 'Unpublished the market report for 2026-11-04', ok: true }] },
  ...over,
});

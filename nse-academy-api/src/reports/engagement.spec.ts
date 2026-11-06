import { engagementAttention } from './bi-rules';
import { biText, engagementHtml } from './bi-render';
import { EngagementMetricsService } from './engagement-metrics.service';
import { boundsForYmd } from './report-helpers';
import { engagement } from './fixtures';

const quiet = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, name: `Member ${i}`, email: `m${i}@x.com`, tier: 'premium', lastActiveAt: '2026-10-10T08:00:00.000Z', endsOn: '2026-11-20' }));

describe('engagementAttention', () => {
  it('says nothing when everyone is active and nothing failed', () => {
    expect(engagementAttention(engagement())).toEqual([]);
  });
  it('flags paying members who have gone quiet, naming them with their renewal date', () => {
    const e = engagement();
    e.members.dormantPaying = quiet(2);
    const out = engagementAttention(e);
    expect(out[0]).toContain('2 paying members have not opened the app in 14 days');
    expect(out[0]).toContain('Member 0 (renews 2026-11-20)');
  });
  it('does not flag dormancy while tracking is too young to know (null), and singularises one member', () => {
    const e = engagement();
    e.members.dormantPaying = null;
    expect(engagementAttention(e)).toEqual([]);
    e.members.dormantPaying = quiet(1);
    expect(engagementAttention(e)[0]).toContain('1 paying member has not opened');
  });
  it('flags failed admin actions', () => {
    const e = engagement();
    e.adminChanges.failed = 2;
    expect(engagementAttention(e)[0]).toContain('2 admin actions failed');
  });
});

describe('engagementHtml', () => {
  it('shows active members, website visitors with the weekly trend, sources, signups by source and top pages', () => {
    const html = engagementHtml(engagement());
    expect(html).toContain('Members active yesterday');
    expect(html).toContain('19% of monthly members came back yesterday');
    expect(html).toContain('Member activity has been recorded since 2026-10-01 (36 days)');
    expect(html).toContain('Visitors yesterday');
    expect(html).toContain('48');
    expect(html).toContain('+24% on the week before'); // 310 vs 250
    expect(html).toContain('whatsapp');
    expect(html).toContain('Signups by source');
    expect(html).toContain('/companies/SCOM');
    expect(html).toContain('Every paying member has used the app');
  });
  it('lists quiet paying members, escaped', () => {
    const e = engagement();
    e.members.dormantPaying = [{ ...quiet(1)[0], name: 'Mal <b>' }];
    const html = engagementHtml(e);
    expect(html).toContain('Paying members gone quiet');
    expect(html).toContain('Mal &lt;b&gt;');
    expect(html).not.toContain('Mal <b>');
  });
  it('explains itself while tracking is new, and when nothing has been recorded yet', () => {
    const e = engagement();
    e.members = { ...e.members, trackingSince: null, trackingDays: 0, dau: 0, wau: 0, mau: 0, stickinessPct: null, dormantPaying: null };
    e.traffic = { day: { pageViews: 0, visitors: 0 }, week: { pageViews: 0, visitors: 0, topPages: [], sources: [], campaigns: [], devices: [], signups: [] }, previousWeek: { pageViews: 0, visitors: 0 } };
    const html = engagementHtml(e);
    expect(html).toContain('tracking has just started');
    expect(html).toContain('will be listed once 14 days');
    expect(html).toContain('No page views recorded yet');
  });
  it('shows admin changes by person, and a quiet day', () => {
    expect(engagementHtml(engagement())).toContain('3 changes by info@vitaldigitalmedia.net (3)');
    expect(engagementHtml(engagement())).toContain('Unpublished the market report for 2026-11-04');
    const e = engagement();
    e.adminChanges = { total: 0, failed: 0, byActor: [], recent: [] };
    expect(engagementHtml(e)).toContain('No changes were made in the admin yesterday');
  });
  it('contributes plain-text lines', () => {
    const t = biText(null, null, engagement()).join('\n');
    expect(t).toContain('MEMBERS: 6 active yesterday');
    expect(t).toContain('WEBSITE: 48 visitors yesterday');
    expect(t).toContain('top source whatsapp');
    expect(t).toContain('ADMIN CHANGES: 3');
  });
});

describe('EngagementMetricsService', () => {
  const day = boundsForYmd('2026-11-05');
  function make() {
    const activity = { metrics: jest.fn().mockResolvedValue({ dau: 6 }) };
    const window = jest.fn(async (from: Date) => ({ pageViews: from.getTime() === day.start.getTime() ? 10 : 70, visitors: from.getTime() === day.start.getTime() ? 4 : 30, topPages: [], sources: [], campaigns: [], devices: [], signups: [] }));
    const analytics = { window, prune: jest.fn().mockResolvedValue(2) };
    const audit = { summary: jest.fn().mockResolvedValue({ total: 1 }), prune: jest.fn().mockResolvedValue(3) };
    return { svc: new EngagementMetricsService(activity as never, analytics as never, audit as never), activity, analytics, audit, window };
  }
  it('assembles members, the day, the week and the week before, and the admin changes for the report day', async () => {
    const { svc, activity, audit, window } = make();
    const out = await svc.build(day);
    expect(activity.metrics).toHaveBeenCalledWith('2026-11-05');
    expect(audit.summary).toHaveBeenCalledWith(day.start, day.end);
    const froms = window.mock.calls.map((c: any[]) => c[0].getTime());
    expect(froms).toContain(day.start.getTime());
    expect(froms).toContain(day.end.getTime() - 7 * 86_400_000);
    expect(froms).toContain(day.end.getTime() - 14 * 86_400_000);
    expect(out.traffic.day).toEqual({ pageViews: 10, visitors: 4 });
    expect(out.traffic.previousWeek).toEqual({ pageViews: 70, visitors: 30 });
  });
  it('prunes page views and the audit trail, and never throws', async () => {
    const { svc, analytics, audit } = make();
    await svc.prune();
    expect(analytics.prune).toHaveBeenCalledWith(400);
    expect(audit.prune).toHaveBeenCalledWith(365);
    analytics.prune.mockRejectedValue(new Error('db down'));
    await expect(svc.prune()).resolves.toBeUndefined();
  });
});

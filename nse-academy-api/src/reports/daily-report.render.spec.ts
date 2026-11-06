import { DailyReportService, DailyReport } from './daily-report.service';
import { boundsForYmd } from './report-helpers';
import { business, system } from './fixtures';

const base = (): DailyReport => ({
  day: boundsForYmd('2026-11-05'),
  market: { sessionYmd: '2026-11-05', sessionLabel: 'Thursday 5 November 2026', isReportDay: true, missingData: false, summary: null },
  activity: {
    signups: { count: 3, recent: [] }, leads: { captured: 0, downloads: 0, converted: 0 }, ebooks: { count: 0, revenueKes: 0 }, contact: { count: 0, recent: [] },
    advisors: { applications: 0, approved: 0, queries: 0, alertsSent: 0, alertRecipients: 0, newClientRequests: 0 }, referrals: { created: 0, rewarded: 0 },
    organizations: { created: 0, names: [] }, priceAlerts: { triggered: 0, activeTotal: 0 },
  },
  subscriptions: { activePaid: 3, premium: 2, intermediary: 1, expiredInDay: 0, expiringSoon: [] },
  attention: [],
});

const service = () => new DailyReportService({} as never, {} as never);

describe('DailyReportService.render - business intelligence', () => {
  it('puts the headline numbers, business and system sections in the email, ahead of the market and activity', () => {
    const out = service().render({ ...base(), business: business(), system: system() });
    const iKpi = out.rawHtml.indexOf('Paying members');
    const iBusiness = out.rawHtml.indexOf('revenue, growth and retention');
    const iSystem = out.rawHtml.indexOf('is everything running?');
    const iActivity = out.rawHtml.indexOf('Activity');
    expect(iKpi).toBeGreaterThan(-1);
    expect(iKpi).toBeLessThan(iBusiness);
    expect(iBusiness).toBeLessThan(iSystem);
    expect(iSystem).toBeLessThan(iActivity);
    expect(out.text.join('\n')).toContain('MRR KSh 1,300');
  });

  it('still produces the original report, unchanged in substance, when the BI services are unavailable', () => {
    const out = service().render(base());
    expect(out.rawHtml).not.toContain('revenue, growth and retention');
    expect(out.rawHtml).not.toContain('is everything running?');
    expect(out.rawHtml).toContain('Subscriptions');
    expect(out.rawHtml).toContain('Activity');
  });

  it('counts system attention items in the subject line', () => {
    const out = service().render({ ...base(), business: business(), system: system(), attention: ['<strong>a</strong>', '<strong>b</strong>'] });
    expect(out.subject).toContain('(2 need attention)');
    expect(service().render(base()).subject).not.toContain('need attention');
  });
});

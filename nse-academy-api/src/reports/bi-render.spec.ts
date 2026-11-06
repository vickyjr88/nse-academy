import { biText, businessHtml, kpiStrip, systemHtml } from './bi-render';
import { business, okJob, system } from './fixtures';

describe('kpiStrip', () => {
  it('shows revenue, paying members with MRR, signups with the weekly trend, and system status', () => {
    const html = kpiStrip(business(), system(), 3);
    expect(html).toContain('KSh 1,425');
    expect(html).toContain('KSh 6,925 this month');
    expect(html).toContain('MRR KSh 1,300');
    expect(html).toContain('+40% wk/wk');
    expect(html).toContain('All clear');
    expect(html).toContain('2 of 2 jobs on schedule');
  });
  it('counts system issues, and degrades to dashes when a source is unavailable', () => {
    const sys = system({ jobs: [okJob('a'), { ...okJob('b'), status: 'failing' } as any, { ...okJob('c'), status: 'overdue' } as any] });
    expect(kpiStrip(business(), sys, 0)).toContain('2 issues');
    const none = kpiStrip(null, null, 5);
    expect(none).toContain('unavailable');
    expect(none).toContain('>5<');
  });
  it('does not pretend there is revenue before the payment ledger has started', () => {
    expect(kpiStrip(business({ revenue: { dayKes: 0, dayPayments: 0, monthToDateKes: 0, last30DaysKes: 0, recordedSince: null } }), null, 0)).toContain('ledger starts with the next payment');
  });
});

describe('businessHtml', () => {
  it('shows the revenue lines, MRR, the funnel with conversion rates, and product usage', () => {
    const html = businessHtml(business());
    expect(html).toContain('Subscription revenue yesterday');
    expect(html).toContain('KSh 1,300');
    expect(html).toContain('Completed the investor profile');
    expect(html).toContain('75.0%'); // 30 / 40
    expect(html).toContain('Paying today');
    expect(html).toContain('5.0%'); // 2 / 40
    expect(html).toContain('Revenue counts payments recorded since 2026-11-06');
    expect(html).toContain('Trades logged');
  });
  it('shows failed imports and omits the ledger caveat when there is no ledger yet', () => {
    const html = businessHtml(business({ product: { ...business().product, statementsFailed: 2 }, revenue: { dayKes: 0, dayPayments: 0, monthToDateKes: 0, last30DaysKes: 0, recordedSince: null } }));
    expect(html).toContain('2 failed');
    expect(html).not.toContain('Revenue counts payments recorded since');
    expect(html).toContain('no payments recorded yet');
  });
});

describe('systemHtml', () => {
  it('reports healthy jobs in one line, with feed, report, AI and email figures', () => {
    const html = systemHtml(system());
    expect(html).toContain('2 of 2');
    expect(html).toContain('96%'); // 52 / 54 polls
    expect(html).toContain('HTTP 429 x2');
    expect(html).toContain('written by anthropic/claude-haiku-5.5');
    expect(html).toContain('$0.0021');
    expect(html).toContain('4/4');
    expect(html).toContain('Transactional emails sent');
  });
  it('lists only the jobs with problems, escaped, and flags a template-story report', () => {
    const sys = system({
      jobs: [okJob('a'), { ...okJob('b', 'Winback <b>'), status: 'overdue', problem: 'No successful run since yesterday' } as any],
      marketReport: { sessionYmd: '2026-11-05', exists: true, status: 'published', aiGenerated: false, model: null },
    });
    const html = systemHtml(sys);
    expect(html).toContain('1 of 2');
    expect(html).toContain('Winback &lt;b&gt;');
    expect(html).not.toContain('Winback <b>');
    expect(html).toContain('template story');
  });
  it('copes with no AI calls, no email data and a campaign', () => {
    const html = systemHtml(system({ ai: { rows: [], calls: 0, failed: 0, unverified: 0, costUsd: 0 }, email: null, campaigns: [{ id: 5, name: 'n', subject: 'Know what deserves a look', sentDate: null, sent: 109, delivered: 108, opens: 54, clicks: 9, unsubscribed: 1, bounced: 1, complaints: 0 }] }));
    expect(html).toContain('No AI requests were made');
    expect(html).toContain('Email delivery statistics were unavailable');
    expect(html).toContain('Know what deserves a look');
    expect(html).toContain('50.0%'); // 54 / 108 opened
  });
});

describe('biText', () => {
  it('summarises business and system in plain text, and is empty when neither is available', () => {
    const t = biText(business(), system()).join('\n');
    expect(t).toContain('MRR KSh 1,300');
    expect(t).toContain('FUNNEL');
    expect(t).toContain('2 of 2 jobs on schedule');
    expect(t).toContain('AI: 4 calls');
    expect(biText(null, null)).toEqual([]);
  });
});

describe('systemHtml - many problems', () => {
  it('shows at most eight problem jobs and points to the admin for the rest', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...okJob(`j${i}`, `Job ${i}`), status: 'overdue', problem: 'x' })) as any;
    const html = systemHtml(system({ jobs: many }));
    expect(html).toContain('Job 7');
    expect(html).not.toContain('Job 8<');
    expect(html).toContain('and 4 more in the admin');
  });
});

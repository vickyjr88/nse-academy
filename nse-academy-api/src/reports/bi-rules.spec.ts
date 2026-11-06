import { businessAttention, conversionPct, emailBounceRate, feedSuccessRate, systemAttention, trendNote } from './bi-rules';
import { business, okJob, system } from './fixtures';

const bad = (name: string, status: 'failing' | 'overdue', extra: object = {}) => ({ ...okJob(name, name), status, problem: 'x', ...extra }) as any;

describe('systemAttention', () => {
  it('says nothing when everything is healthy', () => {
    expect(systemAttention(system(), true)).toEqual([]);
  });

  it('names failing jobs with the error, and overdue jobs separately', () => {
    const out = systemAttention(system({ jobs: [okJob('a'), bad('Report job', 'failing', { lastError: 'HTTP 500 <b>' }), bad('Winback', 'overdue')] }), true);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('1 scheduled job is failing');
    expect(out[0]).toContain('Report job');
    expect(out[0]).toContain('HTTP 500 &lt;b&gt;'); // escaped
    expect(out[1]).toContain('has not run when expected');
    expect(out[1]).toContain('Winback');
  });

  it('flags a low price-poll success rate on a trading day, with the commonest failure, but not at the threshold or on a weekend', () => {
    const low = system({ feed: { attempts: 54, succeeded: 25, failureReasons: { 'HTTP 429': 29 }, snapshotsStored: 25, lastSnapshotAt: null } });
    const out = systemAttention(low, true);
    expect(out[0]).toContain('Only 46% of market price polls succeeded');
    expect(out[0]).toContain('HTTP 429');
    expect(systemAttention(low, false)).toEqual([]);
    expect(systemAttention(system({ feed: { attempts: 10, succeeded: 7, failureReasons: {}, snapshotsStored: 7, lastSnapshotAt: null } }), true)).toEqual([]); // exactly 70%
  });

  it('flags a trading day with no polls at all, unless monitoring is too new to know', () => {
    const none = system({ feed: { attempts: 0, succeeded: 0, failureReasons: {}, snapshotsStored: 0, lastSnapshotAt: null } });
    expect(systemAttention(none, true)[0]).toContain('made no attempts');
    const fresh = system({ ...none, jobs: [{ ...okJob('market-poll'), status: 'no-data' } as any] });
    expect(systemAttention(fresh, true)).toEqual([]);
  });

  it('flags a missing, unpublished or template-only market report on a trading day', () => {
    expect(systemAttention(system({ marketReport: { sessionYmd: '2026-11-05', exists: false, status: null, aiGenerated: null, model: null } }), true)[0]).toContain('No public market report exists for 2026-11-05');
    expect(systemAttention(system({ marketReport: { sessionYmd: '2026-11-05', exists: true, status: 'unpublished', aiGenerated: true, model: 'm' } }), true)[0]).toContain('is unpublished');
    expect(systemAttention(system({ marketReport: { sessionYmd: '2026-11-05', exists: true, status: 'published', aiGenerated: false, model: null } }), true)[0]).toContain('template story');
  });

  it('flags poor AI verification once there is enough volume, and outright AI failures', () => {
    const rows = [{ feature: 'advisor', model: 'm', calls: 5, failed: 0, verified: 2, unverified: 3, costUsd: 0, promptTokens: 0, completionTokens: 0, avgSeconds: 5 }];
    const out = systemAttention(system({ ai: { rows, calls: 5, failed: 0, unverified: 3, costUsd: 0 } }), true);
    expect(out[0]).toContain('Only 40% of AI answers passed verification');
    expect(systemAttention(system({ ai: { rows: [{ ...rows[0], calls: 2, verified: 0, unverified: 2 }], calls: 2, failed: 0, unverified: 2, costUsd: 0 } }), true)).toEqual([]); // too few to judge
    expect(systemAttention(system({ ai: { rows: [], calls: 1, failed: 1, unverified: 0, costUsd: 0 } }), true)[0]).toContain('1 AI request failed outright');
  });

  it('flags bounce and spam problems in email, and a campaign that drew complaints', () => {
    const bounced = system({ email: { requests: 100, delivered: 90, hardBounces: 6, softBounces: 2, blocked: 2, invalid: 0, spamReports: 1, unsubscribed: 0, opens: 0, clicks: 0 } });
    const out = systemAttention(bounced, true);
    expect(out.some((l) => l.includes('10% of transactional email bounced'))).toBe(true);
    expect(out.some((l) => l.includes('1 spam complaint'))).toBe(true);
    const camp = system({ campaigns: [{ id: 1, name: 'n', subject: 'Big <sale>', sentDate: null, sent: 100, delivered: 99, opens: 40, clicks: 5, unsubscribed: 1, bounced: 0, complaints: 2 }] });
    expect(systemAttention(camp, true)[0]).toContain('Big &lt;sale&gt;');
    expect(systemAttention(system({ email: { requests: 5, delivered: 1, hardBounces: 4, softBounces: 0, blocked: 0, invalid: 0, spamReports: 0, unsubscribed: 0, opens: 0, clicks: 0 } }), true)).toEqual([]); // too few to judge
  });
});

describe('businessAttention', () => {
  it('flags failed statement imports and a renewal cliff, and is otherwise quiet', () => {
    expect(businessAttention(business())).toEqual([]);
    expect(businessAttention(business({ product: { ...business().product, statementsFailed: 2 } }))[0]).toContain('2 CDSC statement imports failed');
    expect(businessAttention(business({ churn: { lapsedDay: 0, lapsed30d: 0, expiringNext7: 2 }, recurring: { ...business().recurring, activePaid: 3 } }))[0]).toContain('2 of 3 paying members renew within 7 days');
    expect(businessAttention(business({ churn: { lapsedDay: 0, lapsed30d: 0, expiringNext7: 1 }, recurring: { ...business().recurring, activePaid: 3 } }))).toEqual([]);
  });
});

describe('helpers', () => {
  it('computes rates, handling empty denominators', () => {
    expect(feedSuccessRate({ attempts: 0, succeeded: 0, failureReasons: {}, snapshotsStored: 0, lastSnapshotAt: null })).toBeNull();
    expect(feedSuccessRate(system().feed)).toBeCloseTo(52 / 54, 6);
    expect(emailBounceRate({ ...system().email!, requests: 0 })).toBe(0);
    expect(conversionPct(3, 40)).toBe('7.5%');
    expect(conversionPct(3, 0)).toBe('-');
  });
  it('describes a week-on-week trend', () => {
    expect(trendNote(14, 10)).toBe('+40% on the week before');
    expect(trendNote(5, 10)).toBe('-50% on the week before');
    expect(trendNote(4, 0)).toBe('new this week');
    expect(trendNote(0, 0)).toBe('flat');
  });
});

describe('nameList', () => {
  const { nameList } = require('./bi-rules');
  it('lists a few names in full and collapses the rest, escaping them', () => {
    expect(nameList(['A', 'B'])).toBe('A; B');
    expect(nameList(['a<b'])).toBe('a&lt;b');
    expect(nameList(['1', '2', '3', '4', '5', '6'])).toBe('1; 2; 3; 4; and 2 more (see System health below)');
  });
  it('keeps a bad night with many overdue jobs to one short alert line', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ ...okJob(`j${i}`, `Job ${i}`), status: 'overdue', problem: 'x' })) as any;
    const out = systemAttention(system({ jobs: many }), true);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('11 scheduled jobs have not run');
    expect(out[0]).toContain('and 7 more');
  });
});

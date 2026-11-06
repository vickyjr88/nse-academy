import { cleanActor, describeAction, redactBody } from './audit-describe';

describe('describeAction', () => {
  it('describes subscription changes in words, including the plan and end date', () => {
    expect(describeAction('POST', '/admin/users/u1/subscription', { tier: 'premium', status: 'active', currentPeriodEnd: '2026-12-31T00:00:00Z' })).toEqual({
      action: 'Set the subscription of user u1 to premium (active) until 2026-12-31',
      entityType: 'user',
      entityId: 'u1',
    });
    expect(describeAction('DELETE', '/admin/users/u1/subscription', undefined).action).toBe('Cancelled the subscription of user u1');
  });

  it('describes holding and trade edits with what changed', () => {
    const edit = describeAction('PUT', '/admin/users/u1/holdings/h9', { quantity: 100, avgCost: 28.4 });
    expect(edit.action).toBe('Edited a holding of user u1, shares to 100, cost to 28.4');
    expect(edit.entityType).toBe('holding');
    expect(edit.entityId).toBe('h9');
    expect(describeAction('POST', '/admin/users/u1/holdings', { ticker: 'NSE', quantity: 50 }).action).toBe('Added a holding for user u1: 50 NSE');
    expect(describeAction('DELETE', '/admin/users/u1/trades/t5', undefined)).toMatchObject({ action: 'Deleted a trade of user u1', entityType: 'trade', entityId: 't5' });
  });

  it('describes broadcasts by audience, and campaign actions with their details', () => {
    expect(describeAction('POST', '/admin/broadcast/send', { subject: 'Hello', tier: 'free' }).action).toBe('Sent broadcast "Hello" to free tier');
    expect(describeAction('POST', '/admin/broadcast/send', { subject: 'Hello' }).action).toBe('Sent broadcast "Hello" to all users');
    expect(describeAction('POST', '/admin/campaigns/subscription/schedule', { audience: 'free', scheduledAt: '2026-11-06T04:00:00Z' }).action).toBe('Subscription campaign: schedule (free) for 2026-11-06T04:00:00Z');
    expect(describeAction('POST', '/admin/campaigns/subscription/cancel', { campaignId: 5 }).action).toBe('Subscription campaign: cancel campaign 5');
  });

  it('describes report, tag and broker actions', () => {
    expect(describeAction('POST', '/admin/market-reports/2026-11-05/unpublish', {}).action).toBe('Unpublished the market report for 2026-11-05');
    expect(describeAction('POST', '/admin/market-reports/generate', { date: '2026-11-05', force: true }).action).toBe('Generated the market report for 2026-11-05 (forced)');
    expect(describeAction('PUT', '/admin/brokers/b1', { feePercent: 1.9, isActive: false }).action).toBe('Updated broker b1, fee to 1.9%, hidden');
    expect(describeAction('POST', '/admin/tags/t1/apply', { userIds: ['a', 'b'] }).action).toBe('Applied tag t1 to 2 member(s)');
    expect(describeAction('POST', '/admin/tags/t1/remove', { userIds: ['a'] }).action).toBe('Removed tag t1 from 1 member(s)');
    expect(describeAction('PUT', '/admin/tags/t1', { name: 'vip' }).action).toBe('Renamed tag t1 to "vip"');
  });

  it('falls back to the raw call, with an entity guess, for routes it does not know', () => {
    expect(describeAction('PUT', '/admin/leads/l1/status?x=1', {})).toEqual({ action: 'PUT /admin/leads/l1/status', entityType: 'leads', entityId: 'l1' });
    expect(describeAction('POST', '/admin/lifecycle/run', {})).toMatchObject({ entityType: 'lifecycle', entityId: null });
  });

  it('truncates a long value in a description', () => {
    expect(describeAction('POST', '/admin/broadcast/send', { subject: 'x'.repeat(200) }).action).toContain('...');
  });
});

describe('redactBody', () => {
  it('removes anything that looks like a secret, at any depth, and keeps the rest', () => {
    const out = redactBody({ email: 'a@b.c', password: 'hunter2', nested: { apiKey: 'k', token: 't', ok: 1 }, list: [{ secret: 's', n: 2 }] }) as any;
    expect(out).toEqual({ email: 'a@b.c', password: '[redacted]', nested: { apiKey: '[redacted]', token: '[redacted]', ok: 1 }, list: [{ secret: '[redacted]', n: 2 }] });
  });
  it('cuts long text such as a whole email body, and bounds the total size', () => {
    const out = redactBody({ htmlContent: 'x'.repeat(5000) }) as any;
    expect(out.htmlContent).toContain('(5000 chars)');
    expect(out.htmlContent.length).toBeLessThan(400);
    const huge = redactBody(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, 'v'.repeat(200)]))) as any;
    expect(huge.truncated).toBe(true);
  });
  it('copes with non-objects', () => {
    expect(redactBody(undefined)).toBeUndefined();
    expect(redactBody('plain')).toBe('plain');
    expect(redactBody(7)).toBe(7);
  });
});

describe('cleanActor', () => {
  it('accepts an email-like identity and rejects anything else', () => {
    expect(cleanActor('  info@vitaldigitalmedia.net ')).toBe('info@vitaldigitalmedia.net');
    expect(cleanActor('Vicky Junior')).toBe('Vicky Junior');
    expect(cleanActor('<script>alert(1)</script>')).toBeNull();
    expect(cleanActor('x'.repeat(200))).toBeNull();
    expect(cleanActor(undefined)).toBeNull();
    expect(cleanActor(['a'])).toBeNull();
    expect(cleanActor('')).toBeNull();
  });
});

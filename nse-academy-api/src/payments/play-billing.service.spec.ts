import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PlayBillingService, decideChange, pickEntitlement, isEntitled, shortState } from './play-billing.service';

const DAY = 86_400_000;
const now = new Date('2026-11-14T10:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * DAY);
const row = (tier: string, state: string, days: number | null) => ({ tier, state, expiryTime: days === null ? null : inDays(days) });

describe('entitlement from Play states', () => {
  it('strips the prefix Google puts on states', () => {
    expect(shortState('SUBSCRIPTION_STATE_IN_GRACE_PERIOD')).toBe('IN_GRACE_PERIOD');
    expect(shortState(undefined)).toBe('UNKNOWN');
  });

  it('counts active, cancelled-but-unexpired and grace-period purchases', () => {
    for (const s of ['ACTIVE', 'CANCELED', 'IN_GRACE_PERIOD']) expect(isEntitled(row('premium', s, 5), now)).toBe(true);
  });

  it('does not count on-hold, paused, expired or pending purchases, or ones past their expiry', () => {
    for (const s of ['ON_HOLD', 'PAUSED', 'EXPIRED', 'PENDING', 'REPLACED']) expect(isEntitled(row('premium', s, 5), now)).toBe(false);
    expect(isEntitled(row('premium', 'ACTIVE', -1), now)).toBe(false);
    expect(isEntitled(row('premium', 'ACTIVE', null), now)).toBe(false);
  });

  it('picks the highest tier, then the longest-running purchase', () => {
    const rows = [row('intermediary', 'ACTIVE', 300), row('premium', 'ACTIVE', 10), row('premium', 'CANCELED', 20), row('premium', 'EXPIRED', 400)];
    const best = pickEntitlement(rows, now)!;
    expect(best.tier).toBe('premium');
    expect(best.expiryTime).toEqual(inDays(20));
    expect(pickEntitlement([row('premium', 'EXPIRED', 5)], now)).toBeNull();
  });
});

describe('decideChange', () => {
  const sub = (tier: string, source: string, days: number, status = 'active') => ({ tier, source, status, currentPeriodEnd: inDays(days) });

  it('grants a first Play plan', () => {
    expect(decideChange(row('intermediary', 'ACTIVE', 30), null, now)).toEqual({ action: 'grant', tier: 'intermediary', end: inDays(30), source: 'play' });
  });

  it('follows Google when a renewal moves the expiry on', () => {
    const c = decideChange(row('premium', 'ACTIVE', 60), sub('premium', 'play', 2), now);
    expect(c).toMatchObject({ action: 'grant', end: inDays(60) });
  });

  it('leaves a higher live web plan alone', () => {
    expect(decideChange(row('intermediary', 'ACTIVE', 30), sub('premium', 'paystack', 90), now)).toEqual({ action: 'none' });
  });

  it('keeps web-paid time that outlasts a Play plan of the same tier, and takes Play time that outlasts web time', () => {
    expect(decideChange(row('premium', 'ACTIVE', 30), sub('premium', 'paystack', 90), now)).toEqual({ action: 'none' });
    expect(decideChange(row('premium', 'ACTIVE', 120), sub('premium', 'paystack', 90), now)).toMatchObject({ action: 'grant', end: inDays(120) });
  });

  it('upgrades a lower web plan', () => {
    expect(decideChange(row('premium', 'ACTIVE', 30), sub('intermediary', 'paystack', 90), now)).toMatchObject({ action: 'grant', tier: 'premium', end: inDays(30) });
  });

  it('lapses only a plan that Play itself granted', () => {
    expect(decideChange(null, sub('premium', 'play', 3), now)).toEqual({ action: 'lapse' });
    expect(decideChange(null, sub('premium', 'paystack', 3), now)).toEqual({ action: 'none' });
    expect(decideChange(null, null, now)).toEqual({ action: 'none' });
  });
});

function makeService(remote: any, existingRow: any = null) {
  const subscription = { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}), update: jest.fn() };
  const store: Record<string, any> = existingRow ? { [existingRow.purchaseToken]: existingRow } : {};
  const prisma: any = {
    subscription,
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Ann Member' }) },
    playPurchase: {
      findUnique: jest.fn(async ({ where }: any) => store[where.purchaseToken] ?? null),
      findMany: jest.fn(async () => Object.values(store).filter((r: any) => r.state !== 'REPLACED')),
      upsert: jest.fn(async ({ where, create, update }: any) => (store[where.purchaseToken] = { ...(store[where.purchaseToken] ?? create), ...(store[where.purchaseToken] ? update : {}) })),
      update: jest.fn(async ({ where, data }: any) => Object.assign(store[where.purchaseToken], data)),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const google: any = { enabled: true, packageName: 'net.test', getSubscription: jest.fn().mockResolvedValue(remote), acknowledge: jest.fn().mockResolvedValue(undefined) };
  const payments: any = { getSubscriptionStatus: jest.fn().mockResolvedValue({ tier: 'premium' }), sendSubscriptionConfirmedEmail: jest.fn(), alertAdminOfSubscription: jest.fn() };
  const referrals: any = { completeReferral: jest.fn().mockResolvedValue(undefined) };
  const config: any = { get: (k: string) => (k === 'JWT_SECRET' ? 'secret' : k === 'GOOGLE_PLAY_RTDN_TOKEN' ? 'rtdn-secret' : undefined) };
  const svc = new PlayBillingService(prisma, config, google, payments, referrals);
  return { svc, prisma, google, payments, referrals, subscription, store };
}

const remoteOf = (over: any = {}) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  latestOrderId: 'GPA.1',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  lineItems: [{ productId: 'nse_premium', expiryTime: inDays(30).toISOString(), autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: 'monthly' } }],
  ...over,
});

describe('PlayBillingService.verify', () => {
  it('grants the plan, acknowledges, counts the referral and emails the member', async () => {
    const t = makeService(remoteOf());
    const acct = t.svc.accountIdFor('u1');
    t.google.getSubscription.mockResolvedValue(remoteOf({ externalAccountIdentifiers: { obfuscatedExternalAccountId: acct } }));
    await t.svc.verify('u1', 'tok1');
    expect(t.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ tier: 'premium', source: 'play', status: 'active' }) }));
    expect(t.google.acknowledge).toHaveBeenCalledWith('nse_premium', 'tok1');
    expect(t.referrals.completeReferral).toHaveBeenCalledWith('u1');
    expect(t.payments.sendSubscriptionConfirmedEmail).toHaveBeenCalled();
  });

  it('refuses a token that is already bound to another account', async () => {
    const t = makeService(remoteOf(), { purchaseToken: 'tok1', userId: 'someone-else', state: 'ACTIVE', tier: 'premium', productId: 'nse_premium', expiryTime: inDays(5), acknowledged: true });
    await expect(t.svc.verify('u1', 'tok1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(t.subscription.upsert).not.toHaveBeenCalled();
  });

  it('refuses a purchase that Google says was made for a different account', async () => {
    const t = makeService(remoteOf({ externalAccountIdentifiers: { obfuscatedExternalAccountId: 'not-this-user' } }));
    await expect(t.svc.verify('u1', 'tok1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses a product that is not one of our plans', async () => {
    const t = makeService(remoteOf({ lineItems: [{ productId: 'something_else', expiryTime: inDays(5).toISOString() }] }));
    await expect(t.svc.verify('u1', 'tok1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not grant while the payment is still pending, and says nothing twice on a repeat call', async () => {
    const t = makeService(remoteOf({ subscriptionState: 'SUBSCRIPTION_STATE_PENDING' }));
    await t.svc.verify('u1', 'tok1');
    expect(t.subscription.upsert).not.toHaveBeenCalled();
    expect(t.google.acknowledge).not.toHaveBeenCalled();
    expect(t.referrals.completeReferral).not.toHaveBeenCalled();
  });

  it('marks the superseded token when the member changes plan inside Play', async () => {
    const t = makeService(remoteOf({ linkedPurchaseToken: 'old-token' }));
    await t.svc.verify('u1', 'tok2');
    expect(t.prisma.playPurchase.updateMany).toHaveBeenCalledWith({ where: { purchaseToken: 'old-token', userId: 'u1' }, data: { state: 'REPLACED' } });
  });
});

describe('PlayBillingService notifications', () => {
  it('accepts only the configured shared token', () => {
    const { svc } = makeService(remoteOf());
    expect(svc.checkNotificationToken('rtdn-secret')).toBe(true);
    expect(svc.checkNotificationToken('wrong')).toBe(false);
    expect(svc.checkNotificationToken(undefined)).toBe(false);
  });

  it('re-reads the purchase from Google rather than trusting the message', async () => {
    const t = makeService(remoteOf({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }), { purchaseToken: 'tok1', userId: 'u1', state: 'ACTIVE', tier: 'premium', productId: 'nse_premium', expiryTime: inDays(1), acknowledged: true });
    const data = Buffer.from(JSON.stringify({ packageName: 'net.test', subscriptionNotification: { purchaseToken: 'tok1', notificationType: 13 } })).toString('base64');
    await t.svc.handleNotification({ message: { data } });
    expect(t.google.getSubscription).toHaveBeenCalledWith('tok1');
    expect(t.store.tok1.state).toBe('EXPIRED');
  });

  it('ignores a notification for another app', async () => {
    const t = makeService(remoteOf());
    const data = Buffer.from(JSON.stringify({ packageName: 'other.app', subscriptionNotification: { purchaseToken: 'tok1' } })).toString('base64');
    await t.svc.handleNotification({ message: { data } });
    expect(t.google.getSubscription).not.toHaveBeenCalled();
  });
});

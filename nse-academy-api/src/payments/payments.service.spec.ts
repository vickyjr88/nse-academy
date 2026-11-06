import {
  PaymentsService,
  computeAmountKobo,
  computePeriodEnd,
  computeNewPeriod,
  PLAN_PRICES,
  VALID_MONTHS,
} from './payments.service';

describe('computeAmountKobo', () => {
  it('charges full price for 1 month', () => {
    expect(computeAmountKobo('premium', 1)).toBe(PLAN_PRICES.premium);
    expect(computeAmountKobo('intermediary', 1)).toBe(PLAN_PRICES.intermediary);
  });

  it('applies the 5% discount at 3 months', () => {
    expect(computeAmountKobo('premium', 3)).toBe(Math.round(PLAN_PRICES.premium * 3 * 0.95));
  });

  it('applies the 10% discount at 6 months', () => {
    expect(computeAmountKobo('premium', 6)).toBe(Math.round(PLAN_PRICES.premium * 6 * 0.9));
  });

  it('applies the 15% discount at 12 months - matches the approved example (KSh 5,100)', () => {
    expect(computeAmountKobo('premium', 12)).toBe(510000);
  });

  it('discount grows monotonically with duration', () => {
    const amounts = VALID_MONTHS.map((m) => computeAmountKobo('premium', m) / m);
    for (let i = 1; i < amounts.length; i++) {
      expect(amounts[i]).toBeLessThanOrEqual(amounts[i - 1]);
    }
  });
});

describe('computePeriodEnd', () => {
  it('extends roughly 30 days per month purchased', () => {
    const now = Date.now();
    const end = computePeriodEnd(6).getTime();
    const days = (end - now) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(179);
    expect(days).toBeLessThan(181);
  });

  it('1 month is ~30 days, not the old hardcoded literal duplicated elsewhere', () => {
    const now = Date.now();
    const end = computePeriodEnd(1).getTime();
    const days = (end - now) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
  });
});

function makeService() {
  const subscriptionUpsert = jest.fn().mockResolvedValue({});
  const prisma: any = {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    processedPayment: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    subscription: {
      upsert: subscriptionUpsert,
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'u1@test.com', name: 'Test User' }),
    },
  };
  const configService = { get: jest.fn().mockReturnValue(undefined) };
  const referrals = { completeReferral: jest.fn().mockResolvedValue(undefined) };
  const ebookService = { activateFromWebhook: jest.fn().mockResolvedValue(undefined) };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const paystack = { initializeTransaction: jest.fn(), verifyTransaction: jest.fn() };
  const adminNotifier = { paymentReceived: jest.fn().mockResolvedValue(undefined) };

  const service = new PaymentsService(
    prisma as never,
    configService as never,
    referrals as never,
    ebookService as never,
    brevo as never,
    paystack as never,
    adminNotifier as never,
  );

  return { service, prisma, referrals, ebookService, brevo, subscriptionUpsert, adminNotifier };
}

describe('PaymentsService.handleWebhook', () => {
  it('ignores non charge.success events without touching the database', async () => {
    const { service, subscriptionUpsert } = makeService();
    const result = await service.handleWebhook({ event: 'subscription.disable', data: {} });
    expect(result).toEqual({ received: true });
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });

  it('activates a subscription for a valid charge.success event', async () => {
    const { service, subscriptionUpsert, referrals } = makeService();
    const result = await service.handleWebhook({
      event: 'charge.success',
      data: {
        reference: 'ref_123',
        metadata: { type: 'subscription', userId: 'u1', plan: 'premium', months: 6 },
      },
    });
    expect(result).toEqual({ received: true });
    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    expect(subscriptionUpsert.mock.calls[0][0]).toMatchObject({
      where: { userId: 'u1' },
      create: expect.objectContaining({ tier: 'premium', status: 'active' }),
    });
    expect(referrals.completeReferral).toHaveBeenCalledWith('u1');
  });

  it('sends a confirmation email for a brand-new subscription payment', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await service.handleWebhook({
      event: 'charge.success',
      data: {
        reference: 'ref_new',
        metadata: { type: 'subscription', userId: 'u1', plan: 'premium', months: 1 },
      },
    });
    // The confirmation send is fire-and-forget (void), so flush microtasks.
    await new Promise((r) => setImmediate(r));
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(brevo.sendTransactional.mock.calls[0][0].tags).toContain('subscription-confirmed');
  });

  it('does not re-send the confirmation email when the webhook retries the same reference', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValueOnce({
      paystackSubId: 'ref_dup',
      tier: 'premium',
    });
    await service.handleWebhook({
      event: 'charge.success',
      data: {
        reference: 'ref_dup',
        metadata: { type: 'subscription', userId: 'u1', plan: 'premium', months: 1 },
      },
    });
    await new Promise((r) => setImmediate(r));
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('routes an ebook payment to EbookService instead of touching subscriptions', async () => {
    const { service, ebookService, subscriptionUpsert } = makeService();
    const result = await service.handleWebhook({
      event: 'charge.success',
      data: {
        reference: 'ref_456',
        metadata: { type: 'ebook', userId: 'u1', productId: 'p1', price_kes: 500 },
      },
    });
    expect(result).toEqual({ received: true });
    expect(ebookService.activateFromWebhook).toHaveBeenCalledTimes(1);
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });

  it('ignores (does not throw) a subscription event missing userId', async () => {
    const { service, subscriptionUpsert } = makeService();
    const result = await service.handleWebhook({
      event: 'charge.success',
      data: { reference: 'ref_789', metadata: { type: 'subscription', plan: 'premium' } },
    });
    expect(result).toEqual({ received: true });
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });

  it('ignores (does not throw) an ebook event missing productId', async () => {
    const { service, ebookService } = makeService();
    const result = await service.handleWebhook({
      event: 'charge.success',
      data: { reference: 'ref_abc', metadata: { type: 'ebook', userId: 'u1' } },
    });
    expect(result).toEqual({ received: true });
    expect(ebookService.activateFromWebhook).not.toHaveBeenCalled();
  });

  it('propagates a genuine processing failure instead of swallowing it', async () => {
    const { service, prisma } = makeService();
    (prisma.subscription.upsert as jest.Mock).mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(
      service.handleWebhook({
        event: 'charge.success',
        data: {
          reference: 'ref_fail',
          metadata: { type: 'subscription', userId: 'u1', plan: 'premium' },
        },
      }),
    ).rejects.toThrow('DB unavailable');
  });

  it('alerts the admin once about a new subscription payment, with the discounted amount', async () => {
    const { service, adminNotifier } = makeService();
    await service.handleWebhook({
      event: 'charge.success',
      data: { reference: 'ref_new', metadata: { type: 'subscription', userId: 'u1', plan: 'premium', months: 12 } },
    });
    await new Promise((r) => setImmediate(r));
    expect(adminNotifier.paymentReceived).toHaveBeenCalledTimes(1);
    expect(adminNotifier.paymentReceived).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'Subscription', amountKes: 5100, reference: 'ref_new' }),
    );
  });

  it('does not alert again when Paystack retries a webhook for a reference already recorded', async () => {
    const { service, prisma, adminNotifier } = makeService();
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ paystackSubId: 'ref_dup' });
    await service.handleWebhook({
      event: 'charge.success',
      data: { reference: 'ref_dup', metadata: { type: 'subscription', userId: 'u1', plan: 'premium', months: 1 } },
    });
    await new Promise((r) => setImmediate(r));
    expect(adminNotifier.paymentReceived).not.toHaveBeenCalled();
  });
});


const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-06T10:00:00Z');
const plan = (tier: string, daysLeft: number, status = 'active') => ({ tier, status, currentPeriodEnd: new Date(NOW.getTime() + daysLeft * DAY) });
const daysFrom = (d: Date) => Math.round((d.getTime() - NOW.getTime()) / DAY);

describe('computeNewPeriod', () => {
  it('starts today for a new subscriber, and for one whose plan has lapsed or been cancelled', () => {
    for (const existing of [null, undefined, plan('premium', -3), plan('premium', 10, 'cancelled'), { tier: 'free', status: 'active', currentPeriodEnd: null }]) {
      const r = computeNewPeriod(existing, 'premium', 1, NOW);
      expect(r).toMatchObject({ tier: 'premium', kind: 'new' });
      expect(daysFrom(r.currentPeriodEnd)).toBe(30);
    }
  });

  it('adds a same-plan renewal after the current end, so early renewal loses nothing', () => {
    const r = computeNewPeriod(plan('premium', 20), 'premium', 1, NOW);
    expect(r.kind).toBe('renewal');
    expect(r.tier).toBe('premium');
    expect(daysFrom(r.currentPeriodEnd)).toBe(50);
    expect(daysFrom(computeNewPeriod(plan('intermediary', 5), 'intermediary', 12, NOW).currentPeriodEnd)).toBe(365);
  });

  it('carries the unused days of a cheaper plan into an upgrade at the price ratio', () => {
    // 20 days of KSh 300 plan are worth 12 days of KSh 500 plan; plus the 30 purchased.
    const r = computeNewPeriod(plan('intermediary', 20), 'premium', 1, NOW);
    expect(r).toMatchObject({ tier: 'premium', kind: 'upgrade' });
    expect(daysFrom(r.currentPeriodEnd)).toBe(42);
  });

  it('does not let a long cheap plan be turned into a long expensive one for a single month', () => {
    // 360 days of Intermediary + 1 month Premium: 216 carried + 30 = 246 Premium days, not 390.
    const r = computeNewPeriod(plan('intermediary', 360), 'premium', 1, NOW);
    expect(daysFrom(r.currentPeriodEnd)).toBe(246);
    const paidKes = 3000 + 500;
    expect(paidKes / (246 / 30)).toBeGreaterThan(400); // KSh a month is in line with the discounted 12-month price
  });

  it('keeps a running higher tier if a lower plan is somehow bought, giving proportionally fewer days', () => {
    const r = computeNewPeriod(plan('premium', 20), 'intermediary', 1, NOW);
    expect(r).toMatchObject({ tier: 'premium', kind: 'kept-higher' });
    expect(daysFrom(r.currentPeriodEnd)).toBe(38); // 20 + 30 * 300/500
  });
});

describe('PaymentsService - applying subscription payments', () => {
  const event = (ref: string, plan = 'premium', months = 1) => ({ event: 'charge.success', data: { reference: ref, metadata: { type: 'subscription', userId: 'u1', plan, months } } });

  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }).setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('adds an early renewal to the time the member already has', async () => {
    const { service, prisma, subscriptionUpsert } = makeService();
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1', ...plan('premium', 20), paystackSubId: 'old_ref' });
    await service.handleWebhook(event('ref_renew', 'premium', 1));
    const args = subscriptionUpsert.mock.calls[0][0];
    expect(args.update.tier).toBe('premium');
    expect(daysFrom(args.update.currentPeriodEnd)).toBe(50);
    expect(args.update.paystackSubId).toBe('ref_renew');
  });

  it('sends a renewal email that says time was added, not a welcome', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1', ...plan('premium', 20), paystackSubId: 'old_ref' });
    await service.handleWebhook(event('ref_renew2', 'premium', 3));
    await new Promise((r) => setImmediate(r));
    const mail = brevo.sendTransactional.mock.calls[0][0];
    expect(mail.subject).toBe('Your Premium plan has been extended');
    expect(mail.htmlContent).toContain('added 3 months');
  });

  it('credits the unused days of the old plan on an upgrade', async () => {
    const { service, prisma, subscriptionUpsert } = makeService();
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ userId: 'u1', ...plan('intermediary', 20), paystackSubId: 'old_ref' });
    await service.handleWebhook(event('ref_up', 'premium', 1));
    const args = subscriptionUpsert.mock.calls[0][0];
    expect(args.update.tier).toBe('premium');
    expect(daysFrom(args.update.currentPeriodEnd)).toBe(42);
  });

  it('applies a payment only once when the webhook and the return-page verify race: the loser changes nothing and sends nothing', async () => {
    const { service, prisma, subscriptionUpsert, brevo, adminNotifier, referrals } = makeService();
    (prisma.processedPayment.createMany as jest.Mock).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await service.handleWebhook(event('ref_race'));
    await service.handleWebhook(event('ref_race'));
    await new Promise((r) => setImmediate(r));
    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(adminNotifier.paymentReceived).toHaveBeenCalledTimes(1);
    expect(referrals.completeReferral).toHaveBeenCalledTimes(1);
  });

  it('rolls the payment record back with the subscription change, so a Paystack retry can still apply it', async () => {
    const { service, prisma } = makeService();
    (prisma.subscription.upsert as jest.Mock).mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(service.handleWebhook(event('ref_retry'))).rejects.toThrow('DB unavailable');
    // The failure happened inside the transaction callback, which is what makes the processedPayment insert roll back.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('ignores a webhook that names a plan we do not sell, rather than writing it as a tier', async () => {
    const { service, subscriptionUpsert } = makeService();
    const r = await service.handleWebhook(event('ref_bad', 'platinum'));
    expect(r).toEqual({ received: true });
    expect(subscriptionUpsert).not.toHaveBeenCalled();
  });

  it('verify returns the resulting tier and end date, and a repeat verify of the same payment changes nothing', async () => {
    const { service, prisma, subscriptionUpsert } = makeService();
    const paystack = (service as any).paystack;
    paystack.verifyTransaction.mockResolvedValue({ status: true, data: { status: 'success', metadata: { type: 'subscription', userId: 'u1', plan: 'premium', months: 1 } } });
    const first: any = await service.verifyAny('u1', 'ref_v');
    expect(first).toMatchObject({ success: true, tier: 'premium', type: 'subscription' });
    expect(daysFrom(first.currentPeriodEnd)).toBe(30);
    (prisma.processedPayment.createMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({ ...plan('premium', 30), paystackSubId: 'other' });
    const second = await service.verifyAny('u1', 'ref_v');
    expect(second).toMatchObject({ success: true, tier: 'premium' });
    expect(subscriptionUpsert).toHaveBeenCalledTimes(1);
  });
});

describe('PaymentsService.initializeTransaction - plan changes', () => {
  function withPaystack(existing: unknown) {
    const ctx = makeService();
    (ctx.service as any).paystackSecret = 'sk_test';
    (ctx.prisma.subscription.findUnique as jest.Mock).mockResolvedValue(existing);
    (ctx.service as any).paystack.initializeTransaction.mockResolvedValue({ status: true, data: { authorization_url: 'https://pay', reference: 'r' } });
    return ctx;
  }
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] }).setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('lets an active Premium member extend Premium before it ends', async () => {
    const { service } = withPaystack({ userId: 'u1', ...plan('premium', 5) });
    await expect(service.initializeTransaction('u1', 'a@b.c', 'premium', 12)).resolves.toMatchObject({ reference: 'r' });
  });

  it('lets an Intermediary member extend or upgrade', async () => {
    const { service } = withPaystack({ userId: 'u1', ...plan('intermediary', 5) });
    await expect(service.initializeTransaction('u1', 'a@b.c', 'intermediary', 3)).resolves.toBeDefined();
    await expect(service.initializeTransaction('u1', 'a@b.c', 'premium', 1)).resolves.toBeDefined();
  });

  it('refuses to start a lower plan while a higher one is still running, and says what to do instead', async () => {
    const { service, prisma } = withPaystack({ userId: 'u1', ...plan('premium', 5) });
    await expect(service.initializeTransaction('u1', 'a@b.c', 'intermediary', 1)).rejects.toThrow(/Extend Premium instead/);
    expect((service as any).paystack.initializeTransaction).not.toHaveBeenCalled();
    expect(prisma.subscription.findUnique).toHaveBeenCalled();
  });

  it('allows a lower plan once the higher one has ended', async () => {
    const { service } = withPaystack({ userId: 'u1', ...plan('premium', -2) });
    await expect(service.initializeTransaction('u1', 'a@b.c', 'intermediary', 1)).resolves.toBeDefined();
  });
});

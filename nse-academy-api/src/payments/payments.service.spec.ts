import {
  PaymentsService,
  computeAmountKobo,
  computePeriodEnd,
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
  const prisma = {
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

  const service = new PaymentsService(
    prisma as never,
    configService as never,
    referrals as never,
    ebookService as never,
    brevo as never,
    paystack as never,
  );

  return { service, prisma, referrals, ebookService, brevo, subscriptionUpsert };
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
});

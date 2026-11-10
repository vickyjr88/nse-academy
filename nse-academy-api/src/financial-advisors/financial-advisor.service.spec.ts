import { ForbiddenException } from '@nestjs/common';
import { FinancialAdvisorService } from './financial-advisor.service';

function makeService(overrides: { prisma?: Record<string, unknown> } = {}) {
  const prisma = {
    advisorProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: 'adv1', userId: 'advisorUser1' }),
    },
    advisorClient: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'client1' },
        { userId: 'client2' },
        { userId: 'client3' },
      ]),
    },
    holding: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'client1', email: 'client1@test.com', name: 'Client One' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    advisorAlert: {
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'alert1', ...data })),
    },
    ...overrides.prisma,
  };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const corporate = {};
  const journal = {};
  const config = { get: jest.fn().mockReturnValue(undefined) };

  const service = new FinancialAdvisorService(
    prisma as never,
    brevo as never,
    corporate as never,
    journal as never,
    config as never,
    { advisorApplied: jest.fn().mockResolvedValue(undefined) } as never,
  );

  return { service, prisma, brevo };
}

describe('FinancialAdvisorService.sendAlert', () => {
  it('never contacts users who are not this advisor\'s accepted clients', async () => {
    const { service, prisma } = makeService();

    await service.sendAlert('advisorUser1', {
      ticker: 'scom',
      action: 'BUY',
      message: 'Strong earnings, consider buying.',
    });

    // The bug this guards against: sendAlert used to also findMany() every
    // free-tier user platform-wide and notify them. It must never touch
    // user.findMany at all now - only the three known accepted clients.
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledTimes(3);
    const notifiedIds = (prisma.notification.create as jest.Mock).mock.calls.map((c) => c[0].data.userId);
    expect(new Set(notifiedIds)).toEqual(new Set(['client1', 'client2', 'client3']));
  });

  it('targets only the given userId when one is provided', async () => {
    const { service, prisma } = makeService();

    const result = await service.sendAlert('advisorUser1', {
      ticker: 'scom',
      action: 'BUY',
      message: 'Strong earnings, consider buying.',
      userId: 'client2',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect((prisma.notification.create as jest.Mock).mock.calls[0][0].data.userId).toBe('client2');
    expect(result).toMatchObject({ recipientCount: 1 });
  });

  it('rejects targeting a user who is not an accepted client of this advisor', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.sendAlert('advisorUser1', {
        ticker: 'scom',
        action: 'BUY',
        message: 'Strong earnings, consider buying.',
        userId: 'someRandomUserNotAClient',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('filters SELL alerts to only clients currently holding the ticker', async () => {
    const { service, prisma } = makeService({
      prisma: {
        holding: {
          findMany: jest.fn().mockResolvedValue([{ userId: 'client2' }]),
        },
      },
    });

    const result = await service.sendAlert('advisorUser1', {
      ticker: 'scom',
      action: 'SELL',
      message: 'Consider taking profits.',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect((prisma.notification.create as jest.Mock).mock.calls[0][0].data.userId).toBe('client2');
    expect(result).toMatchObject({ recipientCount: 1 });
  });
});

describe('advisor question allowance', () => {
  const { allowanceTier, nairobiMonthWindow, ADVISOR_QUESTION_ALLOWANCE } = jest.requireActual('./advisor-allowance');
  const now = new Date('2026-11-10T10:00:00Z');

  it('counts a paid plan only while it is active and unexpired', () => {
    expect(allowanceTier({ tier: 'premium', status: 'active', currentPeriodEnd: new Date('2026-12-01T00:00:00Z') }, now)).toBe('premium');
    expect(allowanceTier({ tier: 'premium', status: 'active', currentPeriodEnd: new Date('2026-11-01T00:00:00Z') }, now)).toBe('free');
    expect(allowanceTier({ tier: 'intermediary', status: 'expired' }, now)).toBe('free');
    expect(allowanceTier(null, now)).toBe('free');
    expect(ADVISOR_QUESTION_ALLOWANCE).toEqual({ free: 1, intermediary: 2, premium: 5 });
  });

  it('starts the month at midnight Nairobi time', () => {
    const w = nairobiMonthWindow(new Date('2026-11-30T22:30:00Z')); // already 1 December in Nairobi
    expect(w.start.toISOString()).toBe('2026-11-30T21:00:00.000Z');
    expect(w.next.toISOString()).toBe('2026-12-31T21:00:00.000Z');
  });

  function asking(opts: { tier?: string; used: number; firm?: boolean }) {
    return makeService({
      prisma: {
        advisorClient: { findUnique: jest.fn().mockResolvedValue({ status: 'accepted' }), findFirst: jest.fn().mockResolvedValue(opts.firm ? { id: 'c' } : null) },
        subscription: { findUnique: jest.fn().mockResolvedValue(opts.tier ? { tier: opts.tier, status: 'active', currentPeriodEnd: new Date(Date.now() + 86_400_000) } : null) },
        advisorQuery: { count: jest.fn().mockResolvedValue(opts.used), create: jest.fn().mockResolvedValue({ id: 'q1' }) },
        advisorQueryMessage: { create: jest.fn().mockResolvedValue({}) },
        advisorProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'adv1', userId: 'advisorUser1' }) },
        $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ advisorQuery: { create: jest.fn().mockResolvedValue({ id: 'q1' }) }, advisorQueryMessage: { create: jest.fn().mockResolvedValue({}) } })),
      },
    });
  }

  it('refuses the question after the plan allowance is used, naming the limit and when it resets', async () => {
    const { service } = asking({ tier: 'intermediary', used: 2 });
    await expect(service.submitQuery('u1', 'adv1', { question: 'Is X a good buy?' } as never)).rejects.toMatchObject({
      response: { code: 'ADVISOR_QUESTION_LIMIT', limit: 2, used: 2, remaining: 0, tier: 'intermediary' },
    });
  });

  it('lets a member ask while they have allowance left, and a firm\'s member always', async () => {
    await expect(asking({ tier: 'premium', used: 4 }).service.submitQuery('u1', 'adv1', { question: 'Hello?' } as never)).resolves.toMatchObject({ id: 'q1' });
    await expect(asking({ used: 50, firm: true }).service.submitQuery('u1', 'adv1', { question: 'Hello?' } as never)).resolves.toMatchObject({ id: 'q1' });
  });

  it('reports the remaining allowance', async () => {
    const { service } = asking({ tier: 'premium', used: 3 });
    expect(await service.questionAllowance('u1')).toMatchObject({ tier: 'premium', limit: 5, used: 3, remaining: 2, unlimited: false });
  });
});

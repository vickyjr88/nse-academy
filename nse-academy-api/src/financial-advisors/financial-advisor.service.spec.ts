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

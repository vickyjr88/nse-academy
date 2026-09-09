import { ReferralsService } from './referrals.service';

function makeService() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    referral: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const lifecycle = {
    enterFlow: jest.fn().mockResolvedValue('fe1'),
    completeFlow: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ReferralsService(prisma as never, brevo as never, config as never, lifecycle as never);
  return { service, prisma, brevo, lifecycle };
}

describe('ReferralsService.recordPendingReferral', () => {
  it('does nothing if the referral code does not match any user', async () => {
    const { service, prisma } = makeService();
    await service.recordPendingReferral('bad-code', 'new-user');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('does nothing if the referral code belongs to the new user themselves', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'new-user' });
    await service.recordPendingReferral('self-code', 'new-user');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('does nothing if a referral already exists for this referred user', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'referrer-1' });
    (prisma.referral.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'existing' });
    await service.recordPendingReferral('code', 'new-user');
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('creates a pending referral for a valid, new referral code', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'referrer-1' });
    await service.recordPendingReferral('code', 'new-user');
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerId: 'referrer-1', referredId: 'new-user' },
    });
  });
});

describe('ReferralsService.completeReferral', () => {
  it('does nothing if there is no referral for this user', async () => {
    const { service, prisma, brevo } = makeService();
    await service.completeReferral('user-1');
    expect(prisma.referral.update).not.toHaveBeenCalled();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('does nothing if the referral is already completed (no double-reward)', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.referral.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'r1', status: 'completed' });
    await service.completeReferral('user-1');
    expect(prisma.referral.update).not.toHaveBeenCalled();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('marks the referral completed and rewards both parties', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.referral.findUnique as jest.Mock).mockResolvedValueOnce({
      id: 'r1',
      status: 'pending',
      referrerId: 'referrer-1',
      referredId: 'user-1',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ name: 'Test User', email: 'test@example.com' });
    await service.completeReferral('user-1');
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { status: 'completed', rewardedAt: expect.any(Date) },
    });
    await new Promise((r) => setImmediate(r)); // reward emails are fire-and-forget (void)
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
  });
});

describe('ReferralsService.handleStaleReferralNudge', () => {
  it('does nothing when no referral is stale', async () => {
    const { service, brevo, lifecycle } = makeService();
    await service.handleStaleReferralNudge();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
    expect(lifecycle.enterFlow).not.toHaveBeenCalled();
  });

  it('only queries pending referrals older than the cutoff with no nudge sent yet', async () => {
    const { service, prisma } = makeService();
    await service.handleStaleReferralNudge();
    const where = (prisma.referral.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe('pending');
    expect(where.nudgeSentAt).toBeNull();
    const daysAgo = (Date.now() - where.createdAt.lte.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeCloseTo(7, 0);
  });

  it('enters the referral-nudge flow, sends the email, and stamps nudgeSentAt on success', async () => {
    const { service, prisma, brevo, lifecycle } = makeService();
    (prisma.referral.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'r1', referredId: 'user-1', referred: { id: 'user-1', email: 'a@test.com', name: 'A B' } },
    ]);
    await service.handleStaleReferralNudge();
    expect(lifecycle.enterFlow).toHaveBeenCalledWith('user-1', 'referral-nudge');
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(brevo.sendTransactional.mock.calls[0][0].tags).toContain('referral-nudge');
    expect(prisma.referral.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { nudgeSentAt: expect.any(Date) },
    });
    expect(lifecycle.completeFlow).toHaveBeenCalledWith('fe1', 'sent');
  });

  it('marks the flow entry failed, without crashing the batch, if the DB update after sending throws', async () => {
    // The email send itself never throws (sendStaleReferralNudgeEmail
    // swallows its own errors, same as every other email composer in this
    // codebase) - what the outer try/catch here actually guards is a
    // failure in the nudgeSentAt update that follows the send.
    const { service, prisma, lifecycle } = makeService();
    (prisma.referral.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'r1', referredId: 'user-1', referred: { id: 'user-1', email: 'a@test.com', name: 'A B' } },
    ]);
    (prisma.referral.update as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    await service.handleStaleReferralNudge();
    expect(lifecycle.completeFlow).toHaveBeenCalledWith('fe1', 'failed');
  });
});

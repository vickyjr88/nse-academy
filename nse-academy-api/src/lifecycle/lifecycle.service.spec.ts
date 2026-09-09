import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';

function makeService() {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    subscription: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    corporateLicense: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    tag: {
      upsert: jest.fn().mockResolvedValue({ id: 't1', name: 'engaged-free' }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 't1', name: 'engaged-free' }),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    userTag: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },
    flowEntry: {
      create: jest.fn().mockResolvedValue({ id: 'fe1' }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };

  const service = new LifecycleService(prisma as never, brevo as never, config as never);
  return { service, prisma, brevo };
}

describe('LifecycleService cron jobs', () => {
  it('handleDay1Nurture does nothing when no users match', async () => {
    const { service, brevo } = makeService();
    await service.handleDay1Nurture();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('handleDay1Nurture emails matching users and stamps day1EmailSentAt', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', email: 'u1@test.com', name: 'Test User' },
    ]);
    await service.handleDay1Nurture();
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(brevo.sendTransactional.mock.calls[0][0].tags).toContain('lifecycle-day1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { day1EmailSentAt: expect.any(Date) },
    });
  });

  it('handleDay1Nurture writes a FlowEntry on entry and marks it sent on success', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', email: 'u1@test.com', name: 'Test User' },
    ]);
    await service.handleDay1Nurture();
    expect(prisma.flowEntry.create).toHaveBeenCalledWith({
      data: { userId: 'u1', flow: 'day1-nurture', metadata: undefined },
    });
    expect(prisma.flowEntry.update).toHaveBeenCalledWith({
      where: { id: 'fe1' },
      data: { outcome: 'sent', completedAt: expect.any(Date) },
    });
  });

  it('handleDay1Nurture marks the FlowEntry failed when the send throws', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', email: 'u1@test.com', name: 'Test User' },
    ]);
    (prisma.user.update as jest.Mock).mockRejectedValueOnce(new Error('db down'));
    await service.handleDay1Nurture();
    expect(prisma.flowEntry.update).toHaveBeenCalledWith({
      where: { id: 'fe1' },
      data: { outcome: 'failed', completedAt: expect.any(Date) },
    });
  });

  it('handleDay1Nurture excludes users already emailed and non-free users (query-level, not asserted here beyond the where clause shape)', async () => {
    const { service, prisma } = makeService();
    await service.handleDay1Nurture();
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.day1EmailSentAt).toBeNull();
    expect(where.orgMembership).toBeNull();
    expect(where.OR).toEqual([{ subscription: null }, { subscription: { tier: 'free' } }]);
  });

  it('handleDay7Nurture only targets users with zero completed lessons', async () => {
    const { service, prisma } = makeService();
    await service.handleDay7Nurture();
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.progress).toEqual({ none: { completed: true } });
  });

  it('a send failure for one user does not stop the batch from emailing the rest', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', email: 'u1@test.com', name: 'User One' },
      { id: 'u2', email: 'u2@test.com', name: 'User Two' },
    ]);
    (prisma.user.update as jest.Mock).mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({});
    await service.handleDay1Nurture();
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
  });

  it('handleWinback queries subscriptions in the 7-8 day expired window, not just "expired at all"', async () => {
    const { service, prisma } = makeService();
    await service.handleWinback();
    const where = (prisma.subscription.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.tier).toBe('free');
    expect(where.status).toBe('cancelled');
    expect(where.winbackSentAt).toBeNull();
    expect(where.currentPeriodEnd.gte.getTime()).toBeLessThan(where.currentPeriodEnd.lt.getTime());
  });

  it('handleCorporateExpiringSoon skips a license whose org has no resolvable admin user', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.corporateLicense.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'lic1',
        seats: 5,
        currentPeriodEnd: new Date(),
        org: { name: 'Acme SACCO', adminUserId: 'missing-user' },
      },
    ]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await service.handleCorporateExpiringSoon();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
    expect(prisma.corporateLicense.update).not.toHaveBeenCalled();
  });

  it('handleEngagedFreeTagging only tags users with 3+ completed lessons', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', _count: { progress: 3 } },
      { id: 'u2', _count: { progress: 1 } },
    ]);
    await service.handleEngagedFreeTagging();
    expect(prisma.userTag.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', tagId: 't1', addedBy: 'system:lesson-engagement' }],
      skipDuplicates: true,
    });
    expect(prisma.flowEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u1',
          flow: 'engaged-free-tagging',
          completedAt: expect.any(Date),
          outcome: 'sent',
          metadata: { completedLessons: 3 },
        },
      ],
    });
  });

  it('handleActiveTraderTagging only tags users with 3+ price alerts, as a separate tag from engaged-free', async () => {
    const { service, prisma } = makeService();
    (prisma.tag.upsert as jest.Mock).mockResolvedValueOnce({ id: 't2', name: 'active-trader-free' });
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', _count: { priceAlerts: 3 } },
      { id: 'u2', _count: { priceAlerts: 2 } },
    ]);
    await service.handleActiveTraderTagging();
    expect(prisma.tag.upsert).toHaveBeenCalledWith({
      where: { name: 'active-trader-free' },
      create: { name: 'active-trader-free' },
      update: {},
    });
    expect(prisma.userTag.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', tagId: 't2', addedBy: 'system:price-alert-engagement' }],
      skipDuplicates: true,
    });
    expect(prisma.flowEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'u1',
          flow: 'active-trader-tagging',
          completedAt: expect.any(Date),
          outcome: 'sent',
          metadata: { priceAlertCount: 3 },
        },
      ],
    });
  });

  it('handleDay14Nurture assigns a variant per user and records it in FlowEntry.metadata', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'u1', email: 'u1@test.com', name: 'User One' },
    ]);
    await service.handleDay14Nurture();
    expect(prisma.flowEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        flow: 'day14-nurture',
        metadata: { variant: expect.stringMatching(/^(trade-journal|stock-advisor)$/) },
      },
    });
    const sendCall = brevo.sendTransactional.mock.calls[0][0];
    expect(sendCall.tags).toEqual(
      expect.arrayContaining(['lifecycle-day14', expect.stringMatching(/^variant:(trade-journal|stock-advisor)$/)]),
    );
  });

  it('handleDay14Nurture is deterministic - the same user always gets the same variant across separate runs', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'stable-user', email: 'a@test.com', name: 'A' }])
      .mockResolvedValueOnce([{ id: 'stable-user', email: 'a@test.com', name: 'A' }]);
    await service.handleDay14Nurture();
    const firstVariant = (prisma.flowEntry.create as jest.Mock).mock.calls[0][0].data.metadata.variant;
    await service.handleDay14Nurture();
    const secondVariant = (prisma.flowEntry.create as jest.Mock).mock.calls[1][0].data.metadata.variant;
    expect(secondVariant).toBe(firstVariant);
  });

  it('handleWinback assigns a variant per user and records it in FlowEntry.metadata', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.subscription.findMany as jest.Mock).mockResolvedValueOnce([
      { userId: 'u1', user: { id: 'u1', email: 'u1@test.com', name: 'User One' } },
    ]);
    await service.handleWinback();
    expect(prisma.flowEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'u1',
        flow: 'winback',
        metadata: { variant: expect.stringMatching(/^(data-still-there|social-proof)$/) },
      },
    });
    const sendCall = brevo.sendTransactional.mock.calls[0][0];
    expect(sendCall.tags).toEqual(
      expect.arrayContaining(['subscription-winback', expect.stringMatching(/^variant:(data-still-there|social-proof)$/)]),
    );
  });

  it('handleRenewalNudge queries subscriptions in the 5-6 day expired window, distinct from the 7-8 day winback window', async () => {
    const { service, prisma } = makeService();
    await service.handleRenewalNudge();
    const where = (prisma.subscription.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.renewalNudgeSentAt).toBeNull();
    const daysFromNow = (d: Date) => (d.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysFromNow(where.currentPeriodEnd.gte)).toBeCloseTo(-6, 0);
    expect(daysFromNow(where.currentPeriodEnd.lt)).toBeCloseTo(-5, 0);
  });
});

describe('LifecycleService manual trigger', () => {
  it('rejects a flow that is not backfillable', async () => {
    const { service } = makeService();
    await expect(service.previewManualTrigger('winback')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.triggerManually('engaged-free-tagging')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('previewManualTrigger counts eligible users without sending anything', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.user.count as jest.Mock).mockResolvedValueOnce(42);
    const result = await service.previewManualTrigger('day1-nurture');
    expect(result).toEqual({ count: 42 });
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('triggerManually for day14-nurture ignores signup date and reaches every eligible user', async () => {
    const { service, prisma, brevo } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'old-user', email: 'old@test.com', name: 'Old User' },
    ]);
    const result = await service.triggerManually('day14-nurture');
    // No createdAt filter should appear in the where clause at all - this
    // is the whole point of the manual trigger versus the daily cron.
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.createdAt).toBeUndefined();
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 1, failed: 0 });
  });
});

describe('LifecycleService tag admin API', () => {
  it('createTag rejects a duplicate name', async () => {
    const { service, prisma } = makeService();
    (prisma.tag.findUnique as jest.Mock).mockResolvedValueOnce({ id: 't1', name: 'vip' });
    await expect(service.createTag('vip')).rejects.toBeInstanceOf(ConflictException);
  });

  it('deleteTag throws NotFoundException for an unknown tag', async () => {
    const { service } = makeService();
    await expect(service.deleteTag('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applyTag skips duplicates so re-tagging an already-tagged user is a no-op', async () => {
    const { service, prisma } = makeService();
    (prisma.tag.findUnique as jest.Mock).mockResolvedValueOnce({ id: 't1', name: 'vip' });
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([{ id: 'u1' }]);
    (prisma.userTag.createMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    const result = await service.applyTag('t1', ['u1']);
    expect(prisma.userTag.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', tagId: 't1', addedBy: 'admin:manual' }],
      skipDuplicates: true,
    });
    expect(result).toEqual({ tagged: 1, requested: 1 });
  });
});

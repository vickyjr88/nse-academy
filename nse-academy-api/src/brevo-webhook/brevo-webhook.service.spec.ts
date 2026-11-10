import { BrevoWebhookService } from './brevo-webhook.service';

function makeService() {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    flowEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const suppression = { suppress: jest.fn().mockResolvedValue(undefined) };
  const service = new BrevoWebhookService(prisma as never, suppression as never);
  return { service, prisma, suppression };
}

describe('BrevoWebhookService.handleEvent', () => {
  it('ignores event types other than opened/click', async () => {
    const { service, prisma } = makeService();
    const result = await service.handleEvent({ event: 'delivered', email: 'a@test.com', tags: ['lifecycle-day1'] });
    expect(result).toEqual({ processed: 1, matched: 0 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('ignores an event with no matching user', async () => {
    const { service, prisma } = makeService();
    const result = await service.handleEvent({ event: 'opened', email: 'unknown@test.com', tags: ['lifecycle-day1'] });
    expect(result).toEqual({ processed: 1, matched: 0 });
    expect(prisma.flowEntry.findFirst).not.toHaveBeenCalled();
  });

  it('ignores a tag with no FlowEntry equivalent (e.g. subscription-confirmed)', async () => {
    const { service, prisma } = makeService();
    const result = await service.handleEvent({ event: 'opened', email: 'a@test.com', tags: ['subscription-confirmed'] });
    expect(result).toEqual({ processed: 1, matched: 0 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('maps a known Brevo tag to its flow and stamps openedAt on the matching sent FlowEntry', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'u1' });
    (prisma.flowEntry.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'fe1',
      openedAt: null,
      clickedAt: null,
      clickedUrl: null,
    });
    const result = await service.handleEvent({ event: 'opened', email: 'A@Test.com', tags: ['lifecycle-day14'] });
    expect(result).toEqual({ processed: 1, matched: 1 });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@test.com' }, select: { id: true } });
    expect(prisma.flowEntry.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', flow: 'day14-nurture', outcome: 'sent' },
      orderBy: { enteredAt: 'desc' },
    });
    expect(prisma.flowEntry.update).toHaveBeenCalledWith({
      where: { id: 'fe1' },
      data: { openedAt: expect.any(Date) },
    });
  });

  it('a click backfills openedAt too, when the open event was never received', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'u1' });
    (prisma.flowEntry.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'fe1',
      openedAt: null,
      clickedAt: null,
      clickedUrl: null,
    });
    await service.handleEvent({
      event: 'click',
      email: 'a@test.com',
      tags: ['subscription-winback'],
      link: 'https://nseacademy.vitaldigitalmedia.net/pricing',
    });
    expect(prisma.flowEntry.update).toHaveBeenCalledWith({
      where: { id: 'fe1' },
      data: {
        openedAt: expect.any(Date),
        clickedAt: expect.any(Date),
        clickedUrl: 'https://nseacademy.vitaldigitalmedia.net/pricing',
      },
    });
  });

  it('does not overwrite an existing openedAt/clickedAt on a second click event', async () => {
    const { service, prisma } = makeService();
    const firstOpen = new Date('2026-01-01T00:00:00Z');
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'u1' });
    (prisma.flowEntry.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'fe1',
      openedAt: firstOpen,
      clickedAt: firstOpen,
      clickedUrl: 'https://old-link.example.com',
    });
    await service.handleEvent({ event: 'click', email: 'a@test.com', tags: ['lifecycle-day14'], link: 'https://new-link.example.com' });
    expect(prisma.flowEntry.update).toHaveBeenCalledWith({
      where: { id: 'fe1' },
      data: { openedAt: firstOpen, clickedAt: firstOpen, clickedUrl: 'https://old-link.example.com' },
    });
  });

  it('handles a batched array of events, reporting per-event match count', async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'u1' });
    (prisma.flowEntry.findFirst as jest.Mock).mockResolvedValue({ id: 'fe1', openedAt: null, clickedAt: null, clickedUrl: null });
    const result = await service.handleEvent([
      { event: 'opened', email: 'a@test.com', tags: ['lifecycle-day1'] },
      { event: 'delivered', email: 'a@test.com', tags: ['lifecycle-day1'] },
      { event: 'click', email: 'a@test.com', tags: ['lifecycle-day7'] },
    ]);
    expect(result).toEqual({ processed: 3, matched: 2 });
  });
});

describe('BrevoWebhookService suppression events', () => {
  it.each([['hard_bounce', 'hard_bounce'], ['blocked', 'blocked'], ['spam', 'spam'], ['unsubscribed', 'unsubscribed'], ['invalid_email', 'invalid_email']])('suppresses the address on a %s event', async (event, reason) => {
    const { service, suppression } = makeService();
    const r = await service.handleEvent({ event, email: 'Bad@Example.com', tags: ['lifecycle-day7'] });
    expect(r).toEqual({ processed: 1, matched: 1 });
    expect(suppression.suppress).toHaveBeenCalledWith('Bad@Example.com', reason);
  });

  it('leaves soft bounces, deliveries and deferrals alone: a full mailbox is temporary', async () => {
    const { service, suppression } = makeService();
    await service.handleEvent([{ event: 'soft_bounce', email: 'a@x.com' }, { event: 'delivered', email: 'a@x.com' }, { event: 'deferred', email: 'a@x.com' }]);
    expect(suppression.suppress).not.toHaveBeenCalled();
  });

  it('keeps going when one suppression fails to save', async () => {
    const { service, suppression } = makeService();
    suppression.suppress.mockRejectedValueOnce(new Error('db down'));
    const r = await service.handleEvent([{ event: 'hard_bounce', email: 'a@x.com' }, { event: 'blocked', email: 'b@x.com' }]);
    expect(r).toEqual({ processed: 2, matched: 1 });
  });

  it('counts a unique_opened event as an open for the funnel', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.flowEntry.findFirst.mockResolvedValue({ id: 'f1', openedAt: null });
    const r = await service.handleEvent({ event: 'unique_opened', email: 'a@x.com', tags: ['lifecycle-day1'] });
    expect(r.matched).toBe(1);
    expect(prisma.flowEntry.update).toHaveBeenCalled();
  });
});

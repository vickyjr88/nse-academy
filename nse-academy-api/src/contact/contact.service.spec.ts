import { ContactService, MAX_ALERTS_PER_HOUR, MAX_ALERTS_PER_SENDER_PER_HOUR } from './contact.service';

function makeService(recentFromSender = 0) {
  const created = { id: 'c1', name: 'Jane', email: 'jane@example.com', subject: 'Billing', message: 'I was charged twice <b>help</b>', status: 'new', createdAt: new Date() };
  const prisma = {
    contactSubmission: {
      count: jest.fn().mockResolvedValue(recentFromSender),
      create: jest.fn().mockResolvedValue(created),
    },
  };
  const adminNotifier = {
    notify: jest.fn().mockResolvedValue(undefined),
    adminUrl: jest.fn((p: string) => `https://admin.test/${p}`),
  };
  const service = new ContactService(prisma as never, adminNotifier as never);
  return { service, prisma, adminNotifier };
}
const flush = () => new Promise((r) => setImmediate(r));
const dto = { name: 'Jane', email: 'jane@example.com', subject: 'Billing', message: 'I was charged twice <b>help</b>' };

describe('ContactService.create', () => {
  it('saves the message and emails the admin with Reply-To set to the sender', async () => {
    const { service, prisma, adminNotifier } = makeService();
    await service.create(dto);
    await flush();
    expect(prisma.contactSubmission.create).toHaveBeenCalledTimes(1);
    expect(adminNotifier.notify).toHaveBeenCalledTimes(1);
    const alert = adminNotifier.notify.mock.calls[0][0];
    expect(alert.replyTo).toEqual({ email: 'jane@example.com', name: 'Jane' });
    expect(alert.subject).toContain('Billing');
    expect(alert.button.url).toBe('https://admin.test/contact-submissions/c1');
  });

  it('escapes the visitor message so markup in it cannot inject into the admin email', async () => {
    const { service, adminNotifier } = makeService();
    await service.create(dto);
    await flush();
    const { rawHtml } = adminNotifier.notify.mock.calls[0][0];
    expect(rawHtml).toContain('&lt;b&gt;help&lt;/b&gt;');
    expect(rawHtml).not.toContain('<b>help</b>');
  });

  it('drops a honeypot submission: nothing stored, nobody alerted, and the bot sees a normal success', async () => {
    const { service, prisma, adminNotifier } = makeService();
    const result = await service.create({ ...dto, website: 'http://spam.example' });
    await flush();
    expect(result).toEqual({ received: true });
    expect(prisma.contactSubmission.create).not.toHaveBeenCalled();
    expect(adminNotifier.notify).not.toHaveBeenCalled();
  });

  it('still saves a message from a sender who has already written several times this hour, but stops emailing', async () => {
    const { service, prisma, adminNotifier } = makeService(MAX_ALERTS_PER_SENDER_PER_HOUR);
    await service.create(dto);
    await flush();
    expect(prisma.contactSubmission.create).toHaveBeenCalledTimes(1);
    expect(adminNotifier.notify).not.toHaveBeenCalled();
  });

  it('caps total alert emails per hour so a flood of distinct bots cannot burn the Brevo quota', async () => {
    const { service, prisma, adminNotifier } = makeService(0);
    for (let i = 0; i < MAX_ALERTS_PER_HOUR + 5; i++) await service.create({ ...dto, email: `bot${i}@example.com` });
    await flush();
    expect(prisma.contactSubmission.create).toHaveBeenCalledTimes(MAX_ALERTS_PER_HOUR + 5); // all saved
    expect(adminNotifier.notify).toHaveBeenCalledTimes(MAX_ALERTS_PER_HOUR); // only the cap emailed
  });

  it('still rejects missing fields', async () => {
    const { service } = makeService();
    await expect(service.create({ ...dto, message: '' })).rejects.toThrow('All fields are required');
  });
});

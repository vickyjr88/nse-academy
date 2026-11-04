import { AdminNotifierService, DEFAULT_ADMIN_NOTIFY_EMAIL } from './admin-notifier.service';

function makeService(env: Record<string, string> = {}) {
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((k: string) => env[k]) };
  return { service: new AdminNotifierService(brevo as never, config as never), brevo };
}
const base = { subject: 'S', eyebrow: 'E', heading: 'H', bodyText: ['t'] };

describe('AdminNotifierService', () => {
  it('defaults to info@vitaldigitalmedia.net and parses a comma-separated ADMIN_NOTIFY_EMAIL', () => {
    expect(makeService().service.recipients()).toEqual([DEFAULT_ADMIN_NOTIFY_EMAIL]);
    expect(makeService({ ADMIN_NOTIFY_EMAIL: ' a@x.com , b@y.com,notanemail ' }).service.recipients()).toEqual(['a@x.com', 'b@y.com']);
  });

  it('sends one email per recipient, with replyTo and an admin-alert tag', async () => {
    const { service, brevo } = makeService({ ADMIN_NOTIFY_EMAIL: 'a@x.com,b@y.com' });
    await service.notify({ ...base, replyTo: { email: 'visitor@z.com' }, tags: ['contact-message'] });
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
    expect(brevo.sendTransactional.mock.calls[0][0]).toMatchObject({
      to: { email: 'a@x.com' },
      replyTo: { email: 'visitor@z.com' },
      tags: ['admin-alert', 'contact-message'],
    });
  });

  it('an explicit `to` overrides the configured recipients (used for test sends)', async () => {
    const { service, brevo } = makeService({ ADMIN_NOTIFY_EMAIL: 'a@x.com' });
    await service.notify({ ...base, to: ['test@x.com'] });
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(brevo.sendTransactional.mock.calls[0][0].to.email).toBe('test@x.com');
  });

  it('never throws into the caller when the email provider fails', async () => {
    const { service, brevo } = makeService();
    brevo.sendTransactional.mockRejectedValue(new Error('brevo down'));
    await expect(service.notify(base)).resolves.toBeUndefined();
  });

  it('notifyOnce suppresses a repeat of the same key inside the window but allows a different key', async () => {
    const { service, brevo } = makeService();
    expect(await service.notifyOnce('webhook:ref1', 60_000, base)).toBe(true);
    expect(await service.notifyOnce('webhook:ref1', 60_000, base)).toBe(false);
    expect(await service.notifyOnce('webhook:ref2', 60_000, base)).toBe(true);
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
  });

  it('builds deep links into the Strapi admin from CMS_ADMIN_URL', () => {
    expect(makeService({ CMS_ADMIN_URL: 'https://cms.example.com/' }).service.adminUrl('contact-submissions/9'))
      .toBe('https://cms.example.com/admin/plugins/user-manager/contact-submissions/9');
  });
});

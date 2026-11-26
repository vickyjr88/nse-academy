import { BrevoService } from './brevo.service';

const message = { to: { email: 'a@example.test' }, subject: 'S', htmlContent: '<p>x</p>' };

function make(opts: { key?: string; block?: string; reject?: string } = {}) {
  const config = { get: jest.fn((k: string, d?: string) => (k === 'BREVO_API_KEY' ? (opts.key ?? 'k') : d)) };
  const suppression = { verdict: jest.fn().mockResolvedValue(opts.block ? { send: false, reason: opts.block } : { send: true }) };
  const service = new BrevoService(config as never, suppression as never);
  const request = jest.spyOn(service as never, 'request' as never).mockImplementation((async () => {
    if (opts.reject) throw new Error(opts.reject);
    return null;
  }) as never);
  return { service, request, suppression };
}

describe('BrevoService.sendTransactional result', () => {
  it('says sent only when Brevo accepted the message', async () => {
    const { service, request } = make();
    await expect(service.sendTransactional(message)).resolves.toEqual({ sent: true });
    expect(request).toHaveBeenCalledWith('POST', '/smtp/email', expect.anything());
  });

  it('says blocked, and sends nothing, for a suppressed address', async () => {
    const { service, request } = make({ block: 'address is suppressed (bounced, blocked or unsubscribed)' });
    await expect(service.sendTransactional(message)).resolves.toEqual({ sent: false, blocked: true, reason: 'address is suppressed (bounced, blocked or unsubscribed)' });
    expect(request).not.toHaveBeenCalled();
  });

  it('says failed, without throwing, when Brevo rejects the message', async () => {
    const { service } = make({ reject: 'Brevo 402: not enough credits' });
    await expect(service.sendTransactional(message)).resolves.toEqual({ sent: false, blocked: false, reason: 'Brevo 402: not enough credits' });
  });

  it('says not sent when email is not configured', async () => {
    const { service, request } = make({ key: '' });
    await expect(service.sendTransactional(message)).resolves.toMatchObject({ sent: false, blocked: false });
    expect(request).not.toHaveBeenCalled();
  });

  it('answers why an address would be held back, without sending', async () => {
    await expect(make().service.blockReason('a@example.test')).resolves.toBeNull();
    await expect(make({ block: 'domain has no mail server' }).service.blockReason('a@example.test')).resolves.toBe('domain has no mail server');
  });
});

import { EmailSuppressionService } from './email-suppression.service';
import { BrevoService } from '../brevo/brevo.service';

jest.mock('dns', () => ({ promises: { resolveMx: jest.fn() } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dns = require('dns').promises;

function make(suppressed: string[] = []) {
  const prisma = {
    emailSuppression: {
      findUnique: jest.fn(async ({ where }: any) => (suppressed.includes(where.email) ? { email: where.email } : null)),
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { svc: new EmailSuppressionService(prisma as never), prisma };
}

describe('EmailSuppressionService.verdict', () => {
  beforeEach(() => dns.resolveMx.mockReset());

  it('sends to a normal address whose domain has a mail server', async () => {
    dns.resolveMx.mockResolvedValue([{ exchange: 'mx.example.com', priority: 10 }]);
    expect(await make().svc.verdict('Jane@Example.com')).toEqual({ send: true });
  });

  it('refuses a malformed address, a throwaway domain and a suppressed address, without touching DNS for the first two', async () => {
    const { svc } = make(['bounced@example.com']);
    expect(await svc.verdict('not-an-email')).toMatchObject({ send: false, reason: 'not a valid address' });
    expect(await svc.verdict('x@mailinator.com')).toMatchObject({ send: false, reason: 'throwaway-mail domain' });
    expect(dns.resolveMx).not.toHaveBeenCalled();
    dns.resolveMx.mockResolvedValue([{ exchange: 'mx', priority: 1 }]);
    expect(await svc.verdict('Bounced@Example.com')).toMatchObject({ send: false, reason: expect.stringMatching(/suppressed/) });
  });

  it('refuses a domain that has no mail server, and remembers it for a day', async () => {
    dns.resolveMx.mockRejectedValue(Object.assign(new Error('x'), { code: 'ENOTFOUND' }));
    const { svc } = make();
    expect(await svc.verdict('john@doe.com')).toMatchObject({ send: false, reason: 'domain has no mail server' });
    await svc.verdict('other@doe.com');
    expect(dns.resolveMx).toHaveBeenCalledTimes(1);
  });

  it('still sends when DNS merely fails or times out: that is not proof the address is bad', async () => {
    dns.resolveMx.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' }));
    expect(await make().svc.verdict('a@slow-dns.example')).toEqual({ send: true });
  });

  it('records a suppression lower-cased, ignoring malformed addresses, and can release it', async () => {
    const { svc, prisma } = make();
    await svc.suppress(' Bad@Example.com ', 'hard_bounce');
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledWith({ where: { email: 'bad@example.com' }, create: { email: 'bad@example.com', reason: 'hard_bounce' }, update: { reason: 'hard_bounce' } });
    await svc.suppress('nonsense', 'blocked');
    expect(prisma.emailSuppression.upsert).toHaveBeenCalledTimes(1);
    expect(await svc.release('Bad@Example.com')).toBe(true);
  });

  it('a failing lookup never blocks mail', async () => {
    const { svc, prisma } = make();
    prisma.emailSuppression.findUnique.mockRejectedValue(new Error('db down'));
    dns.resolveMx.mockResolvedValue([{ exchange: 'mx', priority: 1 }]);
    expect(await svc.verdict('a@example.com')).toEqual({ send: true });
  });
});

describe('BrevoService.sendTransactional', () => {
  const config = { get: jest.fn((k: string) => (k === 'BREVO_API_KEY' ? 'key' : undefined)) };
  const gate = (send: boolean) => ({ verdict: jest.fn().mockResolvedValue(send ? { send: true } : { send: false, reason: 'domain has no mail server' }) });
  const spy = (svc: BrevoService) => jest.spyOn(svc as any, 'request').mockResolvedValue({});

  it('does not send to an undeliverable address, unless told to ignore suppression', async () => {
    const svc = new BrevoService(config as never, gate(false) as never);
    const request = spy(svc);
    await svc.sendTransactional({ to: { email: 'john@doe.com' }, subject: 's', htmlContent: 'h' });
    expect(request).not.toHaveBeenCalled();
    await svc.sendTransactional({ to: { email: 'admin@x.com' }, subject: 's', htmlContent: 'h', ignoreSuppression: true });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('tags every message with the app tag, keeping the caller\'s own tags', async () => {
    const svc = new BrevoService(config as never, gate(true) as never);
    const request = spy(svc);
    await svc.sendTransactional({ to: { email: 'a@x.com' }, subject: 's', htmlContent: 'h', tags: ['lifecycle-day7'] });
    expect(request.mock.calls[0][2]).toMatchObject({ tags: ['lifecycle-day7', 'nse-academy'] });
    await svc.sendTransactional({ to: { email: 'a@x.com' }, subject: 's', htmlContent: 'h' });
    expect(request.mock.calls[1][2]).toMatchObject({ tags: ['nse-academy'] });
  });

  it('still works with no suppression service (as in other tests)', async () => {
    const svc = new BrevoService(config as never);
    const request = spy(svc);
    await svc.sendTransactional({ to: { email: 'a@x.com' }, subject: 's', htmlContent: 'h' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});

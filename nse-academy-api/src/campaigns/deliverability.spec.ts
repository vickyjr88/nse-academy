import { DISPOSABLE_DOMAINS, screenAddresses } from './deliverability';

const user = (email: string) => ({ email, name: 'N' });

describe('screenAddresses', () => {
  it('keeps normal addresses and looks each domain up only once', async () => {
    const resolve = jest.fn().mockResolvedValue(true);
    const out = await screenAddresses([user('a@gmail.com'), user('b@gmail.com'), user('c@outlook.com')], resolve);
    expect(out.deliverable.map((u) => u.email)).toEqual(['a@gmail.com', 'b@gmail.com', 'c@outlook.com']);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('drops malformed addresses, throwaway domains (any case) and domains with no mail server, with the reason', async () => {
    const resolve = async (d: string) => d !== 'ghost.example';
    const out = await screenAddresses([user('broken'), user('A@MAILINATOR.COM'), user('x@ghost.example'), user('ok@zoho.eu')], resolve);
    expect(out.deliverable.map((u) => u.email)).toEqual(['ok@zoho.eu']);
    expect(out.excluded.map((e) => e.reason)).toEqual(['not a valid address', 'throwaway-mail domain', 'domain has no mail server']);
    expect(DISPOSABLE_DOMAINS.has('mailinator.com')).toBe(true);
  });

  it('does not look up domains it has already rejected as throwaway', async () => {
    const resolve = jest.fn().mockResolvedValue(true);
    await screenAddresses([user('a@mailinator.com')], resolve);
    expect(resolve).not.toHaveBeenCalled();
  });
});

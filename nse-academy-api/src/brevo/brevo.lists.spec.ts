import { BrevoService } from './brevo.service';

function make() {
  const config = { get: jest.fn((k: string) => (k === 'BREVO_API_KEY' ? 'key' : undefined)) };
  return new BrevoService(config as never);
}

const ok = (body: unknown, status = 200) => ({ ok: true, status, json: async () => body });

describe('BrevoService.clearList', () => {
  afterEach(() => jest.restoreAllMocks());

  it('removes the members explicitly, never with the { all: true } form Brevo rejects', async () => {
    const calls: { url: string; method: string; body?: any }[] = [];
    const pages = [[{ email: 'a@x.com' }, { email: 'b@x.com' }], []];
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method as string, body: init.body ? JSON.parse(init.body as string) : undefined });
      if (init.method === 'GET') return ok({ contacts: pages.shift() ?? [] });
      return { ok: true, status: 204, json: async () => ({}) };
    }) as unknown as typeof fetch;
    await make().clearList(7);
    const removes = calls.filter((c) => c.method === 'POST');
    expect(removes).toHaveLength(1);
    expect(removes[0].url).toContain('/contacts/lists/7/contacts/remove');
    expect(removes[0].body).toEqual({ emails: ['a@x.com', 'b@x.com'] });
    expect(JSON.stringify(calls)).not.toContain('"all"');
  });

  it('removes in chunks of 150 (Brevo\'s limit) and keeps going until the list is empty', async () => {
    const emails = Array.from({ length: 320 }, (_, i) => ({ email: `u${i}@x.com` }));
    const pages = [emails, []];
    const removeSizes: number[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      if (init.method === 'GET') return ok({ contacts: pages.shift() ?? [] });
      removeSizes.push(JSON.parse(init.body as string).emails.length);
      return { ok: true, status: 204, json: async () => ({}) };
    }) as unknown as typeof fetch;
    await make().clearList(7);
    expect(removeSizes).toEqual([150, 150, 20]);
  });

  it('does nothing to an already empty list', async () => {
    const f = jest.fn(async () => ok({ contacts: [] }));
    global.fetch = f as unknown as typeof fetch;
    await make().clearList(7);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('gives up with a clear error rather than looping forever if Brevo never empties the list', async () => {
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => (init.method === 'GET' ? ok({ contacts: [{ email: 'a@x.com' }] }) : { ok: true, status: 204, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(make().clearList(7)).rejects.toThrow(/still has contacts/);
  });
});

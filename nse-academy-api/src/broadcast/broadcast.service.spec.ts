import { BadRequestException } from '@nestjs/common';
import { BroadcastService, ensureUnsubscribeLink } from './broadcast.service';

type U = { email: string; name: string };
const U = (email: string, name = 'N'): U => ({ email, name });

/** A fake Brevo that remembers list membership, so the tests can see who a send would actually reach. */
function make(opts: { users?: Record<string, U[]>; flaky?: Record<string, number>; rejectAlways?: string[] } = {}) {
  const lists = new Map<number, { name: string; folderId: number; members: Set<string> }>();
  lists.set(2, { name: 'base', folderId: 9, members: new Set(['old-member@x.com']) });
  let nextId = 100;
  const calls: Record<string, number> = {};
  const brevo = {
    getList: jest.fn(async (id: number) => {
      const l = lists.get(id);
      return l ? { id, name: l.name, folderId: l.folderId, totalSubscribers: l.members.size } : null;
    }),
    findOrCreateList: jest.fn(async (name: string, folderId: number) => {
      for (const [id, l] of lists) if (l.name === name) return id;
      const id = nextId++;
      lists.set(id, { name, folderId, members: new Set() });
      return id;
    }),
    clearList: jest.fn(async (id: number) => lists.get(id)!.members.clear()),
    upsertContact: jest.fn(async (c: { email: string; listIds: number[] }) => {
      calls[c.email] = (calls[c.email] ?? 0) + 1;
      if (opts.rejectAlways?.includes(c.email)) return false;
      if ((opts.flaky?.[c.email] ?? 0) >= calls[c.email]) return false;
      for (const id of c.listIds) lists.get(id)!.members.add(c.email);
      return true;
    }),
    createCampaign: jest.fn(async (c: { listIds: number[]; htmlContent?: string }) => ({ id: 900 + c.listIds[0] })),
    sendCampaignNow: jest.fn().mockResolvedValue(undefined),
  };
  const byAudience = opts.users ?? {};
  const prisma = {
    user: {
      findMany: jest.fn(async ({ where }: { where: unknown }) => byAudience[JSON.stringify(where)] ?? byAudience.default ?? []),
    },
    broadcastCampaign: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), findMany: jest.fn(), count: jest.fn() },
  };
  const config = { get: jest.fn((k: string) => (k === 'BREVO_BROADCAST_LIST_ID' ? '2' : undefined)) };
  const svc = new BroadcastService(prisma as never, brevo as never, config as never);
  svc.resolveMx = async (d) => d !== 'nomx.example';
  svc.retryDelayMs = 0;
  return { svc, brevo, prisma, lists, calls };
}

const html = '<html><body><p>Hello there, this is a message</p></body></html>';
const FREE = JSON.stringify({ OR: [{ subscription: null }, { subscription: { tier: 'free' } }] });
const PREMIUM = JSON.stringify({ subscription: { tier: 'premium' } });
const membersOf = (lists: ReturnType<typeof make>['lists'], name: string) => [...[...lists.values()].find((l) => l.name === name)!.members].sort();

describe('BroadcastService - who a send actually reaches', () => {
  it('REGRESSION: a send to a smaller audience after a bigger one reaches only the smaller one (the shared, never-emptied list is gone)', async () => {
    const { svc, brevo, lists } = make({ users: { [FREE]: [U('f1@gmail.com'), U('f2@gmail.com')], [PREMIUM]: [U('p1@gmail.com')] } });
    await svc.composeAndSend({ subject: 'One', htmlContent: html, tier: 'free' });
    await svc.composeAndSend({ subject: 'Two', htmlContent: html, tier: 'premium' });
    const [free, premium] = brevo.createCampaign.mock.calls.map((c: any) => c[0].listIds[0]);
    expect(free).not.toBe(premium);
    expect(membersOf(lists, 'NSE Academy broadcast - tier:premium')).toEqual(['p1@gmail.com']);
    expect(membersOf(lists, 'NSE Academy broadcast - tier:free')).toEqual(['f1@gmail.com', 'f2@gmail.com']);
    // and the old shared list is never used as a recipient list
    expect(brevo.createCampaign.mock.calls.every((c: any) => c[0].listIds[0] !== 2)).toBe(true);
  });

  it('empties an audience list before refilling it, so people who left the audience stop receiving', async () => {
    const { svc, lists } = make({ users: { [PREMIUM]: [U('p1@gmail.com')] } });
    await svc.composeAndSend({ subject: 'First', htmlContent: html, tier: 'premium' });
    expect(membersOf(lists, 'NSE Academy broadcast - tier:premium')).toEqual(['p1@gmail.com']);
    // p1 downgrades, p2 upgrades
    (svc as any).prisma.user.findMany = jest.fn(async () => [U('p2@gmail.com')]);
    await svc.composeAndSend({ subject: 'Second', htmlContent: html, tier: 'premium' });
    expect(membersOf(lists, 'NSE Academy broadcast - tier:premium')).toEqual(['p2@gmail.com']);
  });

  it('keeps tier and tag audiences on separate lists', () => {
    const { svc } = make();
    expect(svc.audienceKey()).toBe('all');
    expect(svc.audienceKey('free')).toBe('tier:free');
    expect(svc.audienceKey(undefined, 'abc')).toBe('tag:abc');
    expect(svc.audienceKey('free', 'abc')).toBe('tier:free+tag:abc');
  });
});

describe('BroadcastService - contacts and addresses', () => {
  it('retries contacts Brevo rate-limits instead of dropping them from the audience', async () => {
    const { svc, calls } = make({ users: { default: [U('a@gmail.com'), U('b@gmail.com'), U('c@gmail.com')] }, flaky: { 'b@gmail.com': 2 } });
    const out = await svc.composeAndSend({ subject: 'S', htmlContent: html });
    expect(calls['b@gmail.com']).toBe(3);
    expect(out.failedCount).toBe(0);
    expect(out.audienceCount).toBe(3);
  });

  it('reports contacts that still fail after the retries, and records the real recipient count', async () => {
    const { svc, prisma } = make({ users: { default: [U('a@gmail.com'), U('b@gmail.com')] }, rejectAlways: ['b@gmail.com'] });
    const out = await svc.composeAndSend({ subject: 'S', htmlContent: html });
    expect(out).toMatchObject({ audienceCount: 1, failedCount: 1, failedEmails: ['b@gmail.com'] });
    expect(prisma.broadcastCampaign.create.mock.calls[0][0].data).toMatchObject({ audienceCount: 1, failedCount: 1 });
  });

  it('leaves out addresses that cannot receive mail, and says who and why', async () => {
    const { svc, lists } = make({ users: { default: [U('ok@gmail.com'), U('x@nomx.example'), U('y@mailinator.com'), U('broken')] } });
    const out = await svc.composeAndSend({ subject: 'S', htmlContent: html });
    expect(membersOf(lists, 'NSE Academy broadcast - all')).toEqual(['ok@gmail.com']);
    expect(out.excluded.map((e) => e.reason)).toEqual(['domain has no mail server', 'throwaway-mail domain', 'not a valid address']);
  });

  it('the audience preview counts who will actually be mailed, not everyone on file', async () => {
    const { svc } = make({ users: { default: [U('ok@gmail.com'), U('x@nomx.example'), U('y@mailinator.com')] } });
    expect(await svc.getAudiencePreview()).toEqual({ count: 1, skipped: 2, total: 3 });
  });

  it('refuses to send when nobody in the audience is reachable', async () => {
    const { svc, brevo } = make({ users: { default: [U('x@nomx.example')] } });
    await expect(svc.composeAndSend({ subject: 'S', htmlContent: html })).rejects.toThrow(/deliverable/);
    expect(brevo.sendCampaignNow).not.toHaveBeenCalled();
    const empty = make({ users: { default: [] } });
    await expect(empty.svc.composeAndSend({ subject: 'S', htmlContent: html })).rejects.toThrow(/No users match/);
  });

  it('needs BREVO_BROADCAST_LIST_ID, which supplies the folder for the audience lists', async () => {
    const { svc } = make({ users: { default: [U('a@gmail.com')] } });
    (svc as any).config.get = jest.fn().mockReturnValue(undefined);
    await expect(svc.composeAndSend({ subject: 'S', htmlContent: html })).rejects.toThrow(BadRequestException);
  });
});

describe('BroadcastService - sending', () => {
  it('creates the campaign on the audience list and sends it, recording the audience and tag', async () => {
    const { svc, brevo, prisma } = make({ users: { default: [U('a@gmail.com')] } });
    const out = await svc.composeAndSend({ subject: 'Hello', htmlContent: html, tagId: 'tag1' });
    expect(brevo.createCampaign.mock.calls[0][0].listIds).toEqual([100]);
    expect(brevo.sendCampaignNow).toHaveBeenCalledWith(out.campaignId);
    expect(prisma.broadcastCampaign.create.mock.calls[0][0].data).toMatchObject({ subject: 'Hello', tier: null, tagId: 'tag1', audienceCount: 1 });
  });

  it('will not send the same subject to the same audience twice in a day (a retried request or double click) unless forced', async () => {
    const { svc, prisma, brevo } = make({ users: { default: [U('a@gmail.com')] } });
    (prisma.broadcastCampaign.findFirst as jest.Mock).mockResolvedValueOnce({ brevoCampaignId: 44 });
    await expect(svc.composeAndSend({ subject: 'Hello', htmlContent: html })).rejects.toThrow(/already sent.*campaign 44/);
    expect(prisma.broadcastCampaign.findFirst.mock.calls[0][0].where).toMatchObject({ subject: 'Hello', tier: null, tagId: null });
    expect(brevo.sendCampaignNow).not.toHaveBeenCalled();
    (prisma.broadcastCampaign.findFirst as jest.Mock).mockResolvedValueOnce({ brevoCampaignId: 44 });
    await expect(svc.composeAndSend({ subject: 'Hello', htmlContent: html, force: true })).resolves.toBeDefined();
  });

  it('always sends with an unsubscribe link, adding a footer only when the author left it out', async () => {
    const { svc, brevo, prisma } = make({ users: { default: [U('a@gmail.com')] } });
    await svc.composeAndSend({ subject: 'No link', htmlContent: html });
    const sent = brevo.createCampaign.mock.calls[0][0].htmlContent as string;
    expect(sent).toContain('href="{{ unsubscribe }}"');
    expect(sent.indexOf('{{ unsubscribe }}')).toBeLessThan(sent.indexOf('</body>'));
    expect(prisma.broadcastCampaign.create.mock.calls[0][0].data.htmlContent).toBe(sent);

    const own = '<p>Hi</p><a href="{{ unsubscribe }}">stop</a>';
    expect(ensureUnsubscribeLink(own)).toBe(own);
    expect(ensureUnsubscribeLink('<p>Hi</p><a href="[UNSUBSCRIBE]">stop</a>')).toBe('<p>Hi</p><a href="[UNSUBSCRIBE]">stop</a>');
    expect(ensureUnsubscribeLink('<p>Hi</p>')).toMatch(/<p>Hi<\/p>\n<p [^>]*>You are receiving this[\s\S]*\{\{ unsubscribe \}\}/);
  });

  it('turns a Brevo failure into a readable error', async () => {
    const { svc, brevo } = make({ users: { default: [U('a@gmail.com')] } });
    brevo.sendCampaignNow.mockRejectedValueOnce(new Error('HTTP 400: sender not validated'));
    await expect(svc.composeAndSend({ subject: 'S', htmlContent: html })).rejects.toThrow('HTTP 400: sender not validated');
  });
});

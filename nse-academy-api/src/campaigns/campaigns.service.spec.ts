import { BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { exampleSeries } from './example-series.fixtures';

function make(opts: { series?: boolean; users?: { email: string; name: string }[]; prepared?: Partial<{ listId: number; audienceCount: number; failed: string[]; excluded: { email: string; reason: string }[] }> } = {}) {
  const rows: { ticker: string; d: string; price: number }[] = [];
  if (opts.series !== false) for (const [ticker, s] of exampleSeries()) for (const c of s) rows.push({ ticker, d: c.date, price: c.price });
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(rows),
    broadcastCampaign: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  };
  const brevo = {
    sendTransactional: jest.fn().mockResolvedValue(undefined),
    createCampaign: jest.fn().mockResolvedValue({ id: 555 }),
    sendCampaignTest: jest.fn().mockResolvedValue(undefined),
    deleteCampaign: jest.fn().mockResolvedValue(undefined),
    listCampaigns: jest.fn(async (status: string) => (status === 'queued'
      ? [{ id: 5, name: 'Subscription campaign - free - 2026-11-06T04:00:00.000Z', subject: 'Know what deserves a look', status: 'queued', scheduledAt: '2026-11-06T07:00:00+03:00' }, { id: 9, name: 'Other', subject: 'x', status: 'queued', scheduledAt: null }]
      : [{ id: 3, name: 'Subscription campaign - premium', subject: 'Everything', status: 'sent', sent: 2, delivered: 2, opens: 1 }])),
  };
  const users = opts.users ?? [{ email: 'a@gmail.com', name: 'A' }, { email: 'b@gmail.com', name: 'B' }];
  const broadcast = {
    composeAndSend: jest.fn().mockResolvedValue({ campaignId: 7, audienceCount: 3, failedCount: 0, failedEmails: [] }),
    listAudience: jest.fn().mockResolvedValue(users),
    getAudiencePreview: jest.fn(async (a: string) => ({ count: a === 'free' ? 109 : 1, skipped: a === 'free' ? 4 : 0, total: a === 'free' ? 113 : 1 })),
    prepareAudienceList: jest.fn().mockResolvedValue({ listId: 201, audienceCount: users.length, failed: [], excluded: [], ...opts.prepared }),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const service = new CampaignsService(prisma as never, brevo as never, broadcast as never, config as never);
  return { service, prisma, brevo, broadcast };
}

describe('CampaignsService', () => {
  it('builds the email with the example computed from the stored closes', async () => {
    const { service } = make();
    const { html, subject } = await service.build('free');
    expect(subject).toMatch(/KSh 300\/month/);
    expect(html).toContain('NSE is up 24');
  });

  it('builds without the example, rather than failing, when prices are missing', async () => {
    const { service } = make({ series: false });
    expect((await service.build('free')).html).toContain('What each plan includes');
  });

  it('sends one review copy per audience to the given address only, tagged, with the sample banner and no unsubscribe pretence', async () => {
    const { service, brevo, broadcast } = make();
    const out = await service.sendSamples('me@example.com');
    expect(out.sent.map((s) => s.audience)).toEqual(['free', 'intermediary', 'premium']);
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(3);
    const first = brevo.sendTransactional.mock.calls[0][0];
    expect(first.to).toEqual({ email: 'me@example.com' });
    expect(first.subject).toMatch(/^\[SAMPLE 1\/3 - free\] /);
    expect(first.tags).toEqual(['marketing-sample']);
    expect(first.htmlContent).toContain('SAMPLE FOR REVIEW');
    expect(first.htmlContent).not.toContain('{{ unsubscribe }}');
    expect(broadcast.composeAndSend).not.toHaveBeenCalled();
  });

  it('can send a single audience as a sample', async () => {
    const { service, brevo } = make();
    await service.sendSamples('me@example.com', ['premium']);
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    expect(brevo.sendTransactional.mock.calls[0][0].subject).toMatch(/^\[SAMPLE 1\/1 - premium\]/);
  });

  it('will not send to real users without explicit confirmation', async () => {
    const { service, broadcast } = make();
    await expect(service.sendCampaign('free', false)).rejects.toThrow(BadRequestException);
    expect(broadcast.composeAndSend).not.toHaveBeenCalled();
  });

  it('sends the real campaign through the broadcast tool to exactly the chosen tier, with Brevo\'s unsubscribe link', async () => {
    const { service, broadcast } = make();
    await service.sendCampaign('intermediary', true);
    expect(broadcast.composeAndSend).toHaveBeenCalledTimes(1);
    const dto = broadcast.composeAndSend.mock.calls[0][0];
    expect(dto.tier).toBe('intermediary');
    expect(dto.htmlContent).toContain('href="{{ unsubscribe }}"');
    expect(dto.htmlContent).not.toContain('SAMPLE FOR REVIEW');
  });
});


describe('CampaignsService.scheduleCampaign', () => {
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

  it('needs explicit confirmation and a sensible future time', async () => {
    const { service, brevo } = make();
    await expect(service.scheduleCampaign('free', { confirm: false, scheduledAt: inHours(2) })).rejects.toThrow(/confirm/);
    await expect(service.scheduleCampaign('free', { confirm: true, scheduledAt: 'tomorrow-ish' })).rejects.toThrow(/ISO timestamp/);
    await expect(service.scheduleCampaign('free', { confirm: true, scheduledAt: inHours(0.05) })).rejects.toThrow(/10 minutes/);
    await expect(service.scheduleCampaign('free', { confirm: true, scheduledAt: inHours(24 * 40) })).rejects.toThrow(/30 days/);
    expect(brevo.createCampaign).not.toHaveBeenCalled();
  });

  it('schedules a Brevo campaign for the audience at the given instant on the list the broadcast service prepared, and never sends now', async () => {
    const { service, brevo, broadcast, prisma } = make();
    const at = inHours(2.5);
    const out = await service.scheduleCampaign('intermediary', { confirm: true, scheduledAt: at });
    expect(broadcast.listAudience).toHaveBeenCalledWith('intermediary');
    expect(broadcast.prepareAudienceList).toHaveBeenCalledWith('NSE Academy subscription campaign - intermediary', expect.any(Array));
    const c = brevo.createCampaign.mock.calls[0][0];
    expect(c.scheduledAt).toBe(new Date(at).toISOString());
    expect(c.listIds).toEqual([201]);
    expect(c.htmlContent).toContain('href="{{ unsubscribe }}"');
    expect(c.htmlContent).not.toContain('SAMPLE FOR REVIEW');
    expect(prisma.broadcastCampaign.create.mock.calls[0][0].data).toMatchObject({ brevoCampaignId: 555, tier: 'intermediary', audienceCount: 2 });
    expect(out).toMatchObject({ campaignId: 555, audienceCount: 2, listId: 201 });
  });

  it('passes through who was left out and who could not be added, so nothing is silent', async () => {
    const { service } = make({ prepared: { audienceCount: 1, failed: ['b@gmail.com'], excluded: [{ email: 'john@doe.com', reason: 'domain has no mail server' }] } });
    const out = await service.scheduleCampaign('free', { confirm: true, scheduledAt: inHours(2) });
    expect(out.failed).toEqual(['b@gmail.com']);
    expect(out.excluded).toEqual([{ email: 'john@doe.com', reason: 'domain has no mail server' }]);
    expect(out.audienceCount).toBe(1);
  });

  it('will not schedule the same campaign for the same tier twice in a day unless forced', async () => {
    const { service, prisma, brevo } = make();
    (prisma.broadcastCampaign.findFirst as jest.Mock).mockResolvedValueOnce({ brevoCampaignId: 31 });
    await expect(service.scheduleCampaign('free', { confirm: true, scheduledAt: inHours(2) })).rejects.toThrow(/already scheduled or sent.*campaign 31/);
    expect(brevo.createCampaign).not.toHaveBeenCalled();
    (prisma.broadcastCampaign.findFirst as jest.Mock).mockResolvedValueOnce({ brevoCampaignId: 31 });
    await expect(service.scheduleCampaign('free', { confirm: true, scheduledAt: inHours(2), force: true })).resolves.toBeDefined();
  });

  it('can send a Brevo test of the real campaign and cancel it', async () => {
    const { service, brevo } = make();
    await service.testCampaign(555, ['me@example.com']);
    expect(brevo.sendCampaignTest).toHaveBeenCalledWith(555, ['me@example.com']);
    await service.cancelCampaign(555);
    expect(brevo.deleteCampaign).toHaveBeenCalledWith(555);
  });
});


describe('CampaignsService.overview', () => {
  it('gives each audience its subject and the number of people who would really be mailed', async () => {
    const { service } = make();
    const o = await service.overview();
    expect(o.audiences.map((a) => [a.audience, a.count, a.skipped])).toEqual([['free', 109, 4], ['intermediary', 1, 0], ['premium', 1, 0]]);
    expect(o.audiences[0].subject).toMatch(/KSh 300\/month/);
    expect(o.error).toBeNull();
  });

  it('lists scheduled and sent campaigns, marking the ones this tool created', async () => {
    const { service } = make();
    const o: any = await service.overview();
    expect(o.queued.map((c: any) => [c.id, c.subscriptionCampaign])).toEqual([[5, true], [9, false]]);
    expect(o.sent[0]).toMatchObject({ id: 3, delivered: 2, subscriptionCampaign: true });
  });

  it('still returns the audiences when Brevo is unreachable, and says why', async () => {
    const { service, brevo } = make();
    brevo.listCampaigns.mockRejectedValue(new Error('HTTP 503'));
    const o = await service.overview();
    expect(o.audiences).toHaveLength(3);
    expect(o).toMatchObject({ queued: [], sent: [], error: 'HTTP 503' });
  });
});

describe('CampaignsService.publicExample', () => {
  it('returns the illustrative portfolio on the real closes, with no member data', async () => {
    const { service } = make();
    const ex = await service.publicExample();
    expect(ex.illustrative).toBe(true);
    expect(ex.asOf).toBe('2026-11-05');
    expect(ex.holdings).toHaveLength(5);
    expect(ex.holdings.find((h) => h.ticker === 'NSE')).toMatchObject({ price: 33.65 });
    expect(ex.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(ex)).not.toMatch(/email|userId|@/);
  });

  it('is a 404 rather than a wrong example when a stock has no price history', async () => {
    const { service } = make({ series: false });
    await expect(service.publicExample()).rejects.toThrow('not available');
  });
});

import { BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { exampleSeries } from './example-series.fixtures';

function make(opts: { series?: boolean } = {}) {
  const rows: { ticker: string; d: string; price: number }[] = [];
  if (opts.series !== false) for (const [ticker, s] of exampleSeries()) for (const c of s) rows.push({ ticker, d: c.date, price: c.price });
  const prisma = { $queryRaw: jest.fn().mockResolvedValue(rows) };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const broadcast = { composeAndSend: jest.fn().mockResolvedValue({ campaignId: 7, audienceCount: 3, failedCount: 0, failedEmails: [] }) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  return { service: new CampaignsService(prisma as never, brevo as never, broadcast as never, config as never), prisma, brevo, broadcast };
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

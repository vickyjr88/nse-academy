import { MarketingController } from './marketing.controller';
import { mediaForPlatform } from './platform-copy';

const cards = { story: ['s1', 's2', 's3', 's4', 's5'], feed: ['f1', 'f2'] };

function make(overrides: { publishTarget?: jest.Mock } = {}) {
  const marketReport = {
    getReportForXPosting: jest.fn().mockResolvedValue({ social: { xPost: 'Wrap for the day' }, cardImageUrls: cards.story }),
    getCardSet: jest.fn().mockResolvedValue(cards),
    createXPosts: jest.fn().mockReturnValue(['fallback']),
    markAsPostedToX: jest.fn().mockResolvedValue(undefined),
  };
  const publishTarget =
    overrides.publishTarget ??
    jest.fn(async (target: { platform: string }) => ({ platform: target.platform, status: 'posted', postId: `${target.platform}-1`, url: `https://example.test/${target.platform}` }));
  const social = { publishTarget };
  const automation = { view: jest.fn().mockResolvedValue({ config: { platforms: [{ platform: 'facebook', enabled: true, credentialId: null, suffix: 'Read more', hashtags: '#NSE', tiktokPrivacy: 'SELF_ONLY' }] } }) };
  const config = { get: jest.fn((k: string) => (k === 'WEB_URL' ? 'https://nseacademy.co.ke' : undefined)) };
  const controller = new MarketingController({} as never, marketReport as never, automation as never, {} as never, social as never, config as never);
  return { controller, marketReport, social, publishTarget };
}

describe('MarketingController.postReportToPlatforms', () => {
  it('gives each platform its own cards and the saved suffix, and marks the X post on the report', async () => {
    const { controller, publishTarget, marketReport } = make();
    const out = await controller.postReportToPlatforms({
      reportDate: '2026-11-20',
      targets: [
        { platform: 'x', credentialId: 'cx' },
        { platform: 'facebook', credentialId: 'cf' },
        { platform: 'instagram', credentialId: 'ci' },
      ],
    });
    const calls = publishTarget.mock.calls;
    expect(calls[0][2]).toEqual(['s1', 's2', 's3', 's4']);
    expect(calls[1][2]).toEqual(['s1']);
    expect(calls[2][2]).toEqual(['f1', 'f2']);
    expect(calls[1][0]).toMatchObject({ platform: 'facebook', suffix: 'Read more', hashtags: '#NSE' });
    expect(calls[0][4]).toMatchObject({ reportType: 'daily', reportId: '2026-11-20', mode: 'live' });
    expect(marketReport.markAsPostedToX).toHaveBeenCalledWith('2026-11-20', 'x-1');
    expect(out.results.map((r) => [r.platform, r.status])).toEqual([['x', 'posted'], ['facebook', 'posted'], ['instagram', 'posted']]);
  });

  it('keeps going after one platform fails and reports the reason', async () => {
    const publishTarget = jest.fn(async (target: { platform: string }) => {
      if (target.platform === 'facebook') throw new Error('Failed to post to Facebook: token expired');
      return { platform: target.platform, status: 'posted', postId: 'p', url: 'u' };
    });
    const { controller, marketReport } = make({ publishTarget });
    const out = await controller.postReportToPlatforms({
      reportDate: '2026-11-20',
      targets: [
        { platform: 'facebook', credentialId: 'cf' },
        { platform: 'x', credentialId: 'cx' },
      ],
    });
    expect(out.results[0]).toMatchObject({ platform: 'facebook', status: 'failed', reason: 'Failed to post to Facebook: token expired' });
    expect(out.results[1].status).toBe('posted');
    expect(marketReport.markAsPostedToX).toHaveBeenCalledTimes(1);
  });

  it('reports a skipped delivery as skipped, and does not mark X when the X post did not go out', async () => {
    const publishTarget = jest.fn(async (target: { platform: string }) => ({ platform: target.platform, status: 'skipped', reason: 'no images' }));
    const { controller, marketReport } = make({ publishTarget });
    const out = await controller.postReportToPlatforms({ reportDate: '2026-11-20', targets: [{ platform: 'x', credentialId: 'cx' }, { platform: 'tiktok', credentialId: 'ct' }] });
    expect(out.results.map((r) => [r.status, r.reason])).toEqual([['skipped', 'no images'], ['skipped', 'no images']]);
    expect(marketReport.markAsPostedToX).not.toHaveBeenCalled();
  });

  it('posts once per account even when the same account is listed twice', async () => {
    const { controller, publishTarget } = make();
    await controller.postReportToPlatforms({ reportDate: '2026-11-20', targets: [{ platform: 'x', credentialId: 'cx' }, { platform: 'x', credentialId: 'cx' }] });
    expect(publishTarget).toHaveBeenCalledTimes(1);
  });

  it('uses the plain fallback sentence when the report has no verified one', async () => {
    const { controller, marketReport, publishTarget } = make();
    marketReport.getReportForXPosting.mockResolvedValue({ social: null, cardImageUrls: cards.story });
    await controller.postReportToPlatforms({ reportDate: '2026-11-20', targets: [{ platform: 'x', credentialId: 'cx' }] });
    expect(publishTarget.mock.calls[0][1]).toBe('fallback');
  });

  it('does not touch anything when the report is not published', async () => {
    const { controller, marketReport, publishTarget } = make();
    marketReport.getReportForXPosting.mockRejectedValue(new Error('Report 2026-11-20 is not published yet.'));
    await expect(controller.postReportToPlatforms({ reportDate: '2026-11-20', targets: [{ platform: 'x', credentialId: 'cx' }] })).rejects.toThrow('not published');
    expect(publishTarget).not.toHaveBeenCalled();
  });
});

describe('mediaForPlatform', () => {
  it('limits each platform to what it takes', () => {
    expect(mediaForPlatform('x', cards)).toHaveLength(4);
    expect(mediaForPlatform('threads', cards)).toEqual(['s1']);
    expect(mediaForPlatform('instagram', cards)).toEqual(['f1', 'f2']);
    expect(mediaForPlatform('tiktok', cards)).toHaveLength(5);
    expect(mediaForPlatform('x', { story: [], feed: [] })).toEqual([]);
  });
});

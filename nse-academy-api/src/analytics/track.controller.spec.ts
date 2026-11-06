import { TrackController } from './track.controller';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const VID = '3f2b8c1e-9a4d-4e6f-8b7c-1d2e3f4a5b6c';

function make() {
  const analytics = { record: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((k: string) => (k === 'WEB_URL' ? 'https://nseacademy.vitaldigitalmedia.net' : undefined)) };
  return { c: new TrackController(analytics as never, config as never), analytics };
}

describe('TrackController', () => {
  it('records a page view with the cleaned path, source and device - and nothing identifying', async () => {
    const { c, analytics } = make();
    await c.track({ v: VID, p: '/pricing?x=1', r: 'https://www.google.com/', us: 'Google', um: 'cpc', uc: 'Nov Launch' }, CHROME, undefined);
    expect(analytics.record).toHaveBeenCalledWith({ visitorId: VID, path: '/pricing', referrerHost: 'google.com', utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'nov launch', device: 'desktop' });
    expect(JSON.stringify(analytics.record.mock.calls[0][0])).not.toContain('Mozilla');
  });

  it('ignores our own pages as a referrer', async () => {
    const { c, analytics } = make();
    await c.track({ v: VID, p: '/faq', r: 'https://nseacademy.vitaldigitalmedia.net/pricing' }, CHROME, undefined);
    expect(analytics.record.mock.calls[0][0].referrerHost).toBeNull();
  });

  it('honours Do Not Track, and drops bots, junk ids and junk paths without error', async () => {
    const { c, analytics } = make();
    await c.track({ v: VID, p: '/pricing' }, CHROME, '1');
    await c.track({ v: VID, p: '/pricing' }, 'Googlebot/2.1', undefined);
    await c.track({ v: 'bad', p: '/pricing' }, CHROME, undefined);
    await c.track({ v: VID, p: '/api/auth/login' }, CHROME, undefined);
    await c.track({ v: VID, p: 'pricing' }, CHROME, undefined);
    expect(analytics.record).not.toHaveBeenCalled();
  });

  it('stops a single browser flooding the table', async () => {
    const { c, analytics } = make();
    for (let i = 0; i < 130; i++) await c.track({ v: VID, p: '/pricing' }, CHROME, undefined);
    expect(analytics.record).toHaveBeenCalledTimes(120);
  });
});

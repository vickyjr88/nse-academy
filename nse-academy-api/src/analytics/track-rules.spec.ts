import { HourlyLimiter, cleanPath, cleanUtm, detectDevice, isBot, referrerHost, validVisitorId } from './track-rules';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605 Mobile/15E148';

describe('isBot / detectDevice', () => {
  it('drops crawlers, link-preview fetchers, scripts and requests with no user agent', () => {
    for (const ua of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'curl/8.1', 'python-requests/2.31', 'HeadlessChrome/120', 'Lighthouse', 'UptimeRobot', 'Slackbot-LinkExpanding', undefined, '']) expect(isBot(ua)).toBe(true);
    expect(isBot(CHROME)).toBe(false);
    expect(isBot(IPHONE)).toBe(false);
  });
  it('classifies the device from the user agent without keeping it', () => {
    expect(detectDevice(CHROME)).toBe('desktop');
    expect(detectDevice(IPHONE)).toBe('mobile');
    expect(detectDevice('Mozilla/5.0 (Linux; Android 13; SM-S918B) Mobile Safari')).toBe('mobile');
    expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet');
    expect(detectDevice(undefined)).toBe('desktop');
  });
});

describe('validVisitorId', () => {
  it('accepts a UUID-like id and rejects anything else', () => {
    expect(validVisitorId('3f2b8c1e-9a4d-4e6f-8b7c-1d2e3f4a5b6c')).toBe(true);
    for (const bad of ['short', 'x'.repeat(65), 'has spaces in the id!!', '<script>alert(1)</script>', 42, null, undefined]) expect(validVisitorId(bad)).toBe(false);
  });
});

describe('cleanPath', () => {
  it('keeps a normal page path and drops the query and fragment, which can carry tokens', () => {
    expect(cleanPath('/pricing')).toBe('/pricing');
    expect(cleanPath('/auth/reset-password?token=abc123secret#top')).toBe('/auth/reset-password');
    expect(cleanPath('/')).toBe('/');
    expect(cleanPath('/blog/how-to-buy-shares/')).toBe('/blog/how-to-buy-shares');
  });
  it('replaces long opaque segments (database ids, tokens) so pages group together', () => {
    expect(cleanPath('/advisors/cmo9e032a0034117coxw37lju')).toBe('/advisors/:id');
    expect(cleanPath('/dashboard/learn/getting-started/lesson-1')).toBe('/dashboard/learn/getting-started/lesson-1');
    expect(cleanPath('/market-report/2026-11-05')).toBe('/market-report/2026-11-05');
  });
  it('rejects non-pages and junk', () => {
    for (const bad of ['pricing', '/api/auth/login', '/_next/static/x.js', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/a b', '/' + 'x'.repeat(250), 5, null, undefined, '']) expect(cleanPath(bad as never)).toBeNull();
  });
  it('collapses repeated slashes', () => {
    expect(cleanPath('//pricing//x')).toBe('/pricing/x');
  });
});

describe('referrerHost', () => {
  const own = ['nseacademy.vitaldigitalmedia.net', 'www.example.test'];
  it('returns the host a visitor came from, without www', () => {
    expect(referrerHost('https://www.google.com/search?q=nse+academy', own)).toBe('google.com');
    expect(referrerHost('https://t.co/abc', own)).toBe('t.co');
  });
  it('treats our own site, localhost, empty and unparseable values as no referrer', () => {
    expect(referrerHost('https://nseacademy.vitaldigitalmedia.net/pricing', own)).toBeNull();
    expect(referrerHost('https://example.test/x', own)).toBeNull();
    expect(referrerHost('http://localhost:3000/', own)).toBeNull();
    expect(referrerHost('', own)).toBeNull();
    expect(referrerHost('not a url', own)).toBeNull();
    expect(referrerHost(undefined, own)).toBeNull();
  });
});

describe('cleanUtm', () => {
  it('normalises campaign labels and strips anything unsafe', () => {
    expect(cleanUtm('  WhatsApp ')).toBe('whatsapp');
    expect(cleanUtm('nov-launch_2026')).toBe('nov-launch_2026');
    expect(cleanUtm('<script>x</script>')).toBe('scriptxscript');
    expect(cleanUtm('x'.repeat(100))).toHaveLength(60);
    expect(cleanUtm('   ')).toBeNull();
    expect(cleanUtm(5)).toBeNull();
  });
});

describe('HourlyLimiter', () => {
  it('allows a burst up to the limit, then blocks until the hour is up', () => {
    const l = new HourlyLimiter(3);
    const t = 1_000_000;
    expect([l.allow('a', t), l.allow('a', t), l.allow('a', t), l.allow('a', t)]).toEqual([true, true, true, false]);
    expect(l.allow('b', t)).toBe(true);
    expect(l.allow('a', t + 3_600_001)).toBe(true);
  });
  it('bounds its own memory', () => {
    const l = new HourlyLimiter(5, 3);
    for (const k of ['a', 'b', 'c', 'd']) expect(l.allow(k, 1)).toBe(true);
  });
});

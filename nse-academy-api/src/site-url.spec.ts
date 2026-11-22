import { PUBLIC_SITE_URL, isLegacyPublicHost, publicSiteUrl } from './site-url';

function config(values: Record<string, string | undefined>) {
  return (key: string) => values[key];
}

describe('publicSiteUrl', () => {
  it('falls back to the public site when nothing is configured', () => {
    expect(publicSiteUrl(config({}))).toBe(PUBLIC_SITE_URL);
  });

  it('prefers SITE_URL over WEB_URL', () => {
    expect(
      publicSiteUrl(config({ SITE_URL: 'https://site.test', WEB_URL: 'https://other.test' })),
    ).toBe('https://site.test');
  });

  it('rewrites an old host still saved in the environment', () => {
    expect(
      publicSiteUrl(config({ SITE_URL: 'https://nseacademy.vitaldigitalmedia.net' })),
    ).toBe(PUBLIC_SITE_URL);
    expect(
      publicSiteUrl(config({ WEB_URL: 'https://www.nseacademy.vitaldigitalmedia.net/' })),
    ).toBe(PUBLIC_SITE_URL);
  });

  it('keeps a non-legacy host such as localhost or a test double', () => {
    expect(publicSiteUrl(config({ SITE_URL: 'http://localhost:3010/' }))).toBe(
      'http://localhost:3010',
    );
  });

  it('falls back to the public site for a malformed value', () => {
    expect(publicSiteUrl(config({ SITE_URL: 'not a url' }))).toBe(PUBLIC_SITE_URL);
  });

  it('recognises the old hosts, including www and the short form', () => {
    expect(isLegacyPublicHost('nseacademy.vitaldigitalmedia.net')).toBe(true);
    expect(isLegacyPublicHost('www.nseacademy.vitaldigitalmedia.net')).toBe(true);
    expect(isLegacyPublicHost('nseacademy.vdm.net')).toBe(true);
    expect(isLegacyPublicHost('nseacademy.co.ke')).toBe(false);
  });
});

/** The public website. The old host still appears in env and in saved card URLs. */
export const PUBLIC_SITE_URL = 'https://nseacademy.co.ke';

const LEGACY_HOSTS = new Set([
  'nseacademy.vitaldigitalmedia.net',
  'www.nseacademy.vitaldigitalmedia.net',
  'nseacademy.vdm.net',
]);

export function isLegacyPublicHost(hostname: string): boolean {
  return LEGACY_HOSTS.has(hostname);
}

/**
 * Origin used in links and card images. SITE_URL wins over WEB_URL.
 * A configured value that is still the old host is rewritten to the public site.
 * Any other host (localhost, a test double) is left as given.
 */
export function publicSiteUrl(get: (key: string) => string | undefined): string {
  const raw = (get('SITE_URL') || get('WEB_URL') || PUBLIC_SITE_URL).trim().replace(/\/$/, '');
  try {
    const url = new URL(raw);
    if (isLegacyPublicHost(url.hostname)) return PUBLIC_SITE_URL;
    return url.origin;
  } catch {
    return PUBLIC_SITE_URL;
  }
}

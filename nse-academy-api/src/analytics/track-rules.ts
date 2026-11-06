// Pure rules for the first-party page-view tracker: what to accept, what to throw away, what to keep. Nothing about a
// person is kept - no IP address, no user-agent string - only an anonymous browser id, a path, and where they came from.

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|monitor|uptime|curl|wget|python-requests|httpclient|axios|node-fetch|java\//i;

/** No user-agent at all, or one that announces itself as automated. */
export function isBot(userAgent: string | undefined | null): boolean {
  return !userAgent || BOT.test(userAgent);
}

export type Device = 'mobile' | 'tablet' | 'desktop';

export function detectDevice(userAgent: string | undefined | null): Device {
  const ua = userAgent ?? '';
  if (/ipad|tablet|kindle|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
  return 'desktop';
}

const VISITOR_ID = /^[A-Za-z0-9-]{16,64}$/;
export const validVisitorId = (v: unknown): v is string => typeof v === 'string' && VISITOR_ID.test(v);

const IGNORED_PREFIXES = ['/api', '/_next', '/favicon', '/robots', '/sitemap', '/llms.txt'];

/**
 * The page path to record: no query or fragment (those can carry tokens), long opaque segments (ids, reset tokens)
 * replaced by ":id" so pages group together, and null for anything that is not a real page.
 */
export function cleanPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let p = raw.split('#')[0].split('?')[0].trim();
  if (!p.startsWith('/') || p.length > 200 || /[\s\u0000-\u001f]/.test(p)) return null;
  p = p.replace(/\/{2,}/g, '/');
  if (IGNORED_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`) || p.startsWith(x))) return null;
  const segments = p.split('/').map((s) => (/^(?=.*\d)[A-Za-z0-9_-]{20,}$/.test(s) ? ':id' : s));
  p = segments.join('/');
  return p.length > 1 ? p.replace(/\/$/, '') : p;
}

/** The host a visitor arrived from, or null for direct visits, internal navigation and unusable values. */
export function referrerHost(raw: unknown, ownHosts: string[]): string | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || host === 'localhost') return null;
    if (ownHosts.some((h) => host === h.replace(/^www\./, '').toLowerCase())) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

/** A UTM value cleaned to a short, harmless label, or null. */
export function cleanUtm(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase().replace(/[^\w\-. +]/g, '').slice(0, 60);
  return v || null;
}

/** Simple per-visitor limiter so one browser cannot flood the table. */
export class HourlyLimiter {
  private readonly hits = new Map<string, { count: number; start: number }>();
  constructor(private readonly max = 120, private readonly maxKeys = 10_000) {}

  allow(key: string, now = Date.now()): boolean {
    if (this.hits.size >= this.maxKeys) this.hits.clear();
    const e = this.hits.get(key);
    if (!e || now - e.start >= 3_600_000) {
      this.hits.set(key, { count: 1, start: now });
      return true;
    }
    e.count += 1;
    return e.count <= this.max;
  }
}

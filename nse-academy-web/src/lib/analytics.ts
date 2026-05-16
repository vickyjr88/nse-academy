'use client';

import posthog from 'posthog-js';

/**
 * Thin guarded wrappers around posthog-js. Safe to call before init, on the
 * server, or when the key isn't configured — they no-op silently rather than
 * throwing. All event capture should go through these so we have a single
 * place to add sampling / consent / mask logic later.
 */

function isReady(): boolean {
  if (typeof window === 'undefined') return false;
  if (!posthog.__loaded) return false;
  return true;
}

export function trackEvent(
  event: string,
  props?: Record<string, unknown>,
): void {
  if (!isReady()) return;
  try {
    posthog.capture(event, props);
  } catch {
    // Analytics failures must never break the UX.
  }
}

/**
 * Tie subsequent events to a user. Call right after login / register
 * succeeds. Persists across pageviews until reset() is called.
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  if (!isReady()) return;
  try {
    posthog.identify(userId, traits);
  } catch {
    // ignore
  }
}

/**
 * Clear identity on logout so the next anonymous session isn't conflated
 * with the previous user. Use sparingly — only on explicit logout.
 */
export function resetIdentity(): void {
  if (!isReady()) return;
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}

/**
 * Decode a JWT payload without verification. We use it client-side only to
 * pull the user id / email out of an access_token we just minted, so a
 * trustworthy issuer is implied. Returns null on any parse failure.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(
  token: string,
): T | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const padding = padded.length % 4 ? 4 - (padded.length % 4) : 0;
    const json = atob(padded + '='.repeat(padding));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

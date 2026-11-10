// The market data provider's plan allows a fixed number of requests in a rolling window (the BASIC plan: 4 an hour,
// reported in the body of its HTTP 429 reply). These rules keep the poller inside that allowance and spread the
// requests evenly, instead of firing as fast as a timer allows and being refused for the rest of the hour.

export const DEFAULT_MAX_PER_HOUR = 4;
/** One minute over an hour: the provider's window edge is not exact, and a request one second early would be refused. */
export const WINDOW_MS = 61 * 60_000;

export type PollDecision = { ok: true } | { ok: false; reason: 'window-full' | 'too-soon'; waitMs: number };

/**
 * May a request go out now? `sentAt` is when each recent request was made (successful or not, since a refused request
 * still counts against some providers). `spaced` also requires an even gap of an hour / max, less 30 seconds.
 */
export function pollDecision(sentAt: number[], now: number, max: number, spaced = true): PollDecision {
  const inWindow = sentAt.filter((t) => now - t < WINDOW_MS).sort((a, b) => a - b);
  if (inWindow.length >= max) return { ok: false, reason: 'window-full', waitMs: inWindow[inWindow.length - max] + WINDOW_MS - now };
  if (spaced && inWindow.length > 0) {
    const gap = Math.max(60 * 60_000 / max - 30_000, 0);
    const since = now - inWindow[inWindow.length - 1];
    if (since < gap) return { ok: false, reason: 'too-soon', waitMs: gap - since };
  }
  return { ok: true };
}

/** What the provider said about its own limit in a 429 reply, if it said. */
export function parseRateLimit(body: unknown): { plan: string | null; limit: number; windowMinutes: number } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const limit = Number(b.limit);
  const windowMinutes = Number(b.windowMinutes);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(windowMinutes) || windowMinutes <= 0) return null;
  return { plan: typeof b.plan === 'string' ? b.plan : null, limit, windowMinutes };
}

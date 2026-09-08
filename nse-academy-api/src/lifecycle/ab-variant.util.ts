import { createHash } from 'crypto';

/**
 * Deterministic A/B assignment: same userId + testName always yields the
 * same variant, so a user who somehow gets processed twice (a retried
 * cron run, a manual trigger after a partial failure) never sees a
 * different pitch than the first time - and a variant's results are
 * comparable across time without a separate assignment table to look up.
 * Splits are computed from a hash rather than Math.random() for exactly
 * this reason: no randomness to persist, nothing to get out of sync.
 */
export function assignVariant<T extends string>(userId: string, testName: string, variants: readonly T[]): T {
  if (variants.length === 0) {
    throw new Error(`assignVariant("${testName}") called with no variants`);
  }
  const hash = createHash('sha256').update(`${testName}:${userId}`).digest();
  const index = hash[0] % variants.length;
  return variants[index];
}

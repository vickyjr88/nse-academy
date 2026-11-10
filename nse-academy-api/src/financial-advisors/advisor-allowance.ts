// How many questions a member may put to their advisors each month. Advice from a person is the costly part of
// the service, so it is rationed by plan instead of promised as "unlimited". Members who joined through a firm
// (a SACCO or company plan) are exempt: their firm already pays for the advisor.

export type AllowanceTier = 'free' | 'intermediary' | 'premium';

export const ADVISOR_QUESTION_ALLOWANCE: Record<AllowanceTier, number> = { free: 1, intermediary: 2, premium: 5 };

const EAT_MS = 3 * 3_600_000;

export function allowanceTier(sub: { tier: string; status: string; currentPeriodEnd?: Date | null } | null | undefined, now = new Date()): AllowanceTier {
  if (!sub || sub.status !== 'active') return 'free';
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() <= now.getTime()) return 'free';
  return sub.tier === 'premium' || sub.tier === 'intermediary' ? sub.tier : 'free';
}

/** The first instant of the current month in Nairobi (UTC+3, no daylight saving), and of the next. */
export function nairobiMonthWindow(now = new Date()): { start: Date; next: Date } {
  const eat = new Date(now.getTime() + EAT_MS);
  const y = eat.getUTCFullYear();
  const m = eat.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1) - EAT_MS), next: new Date(Date.UTC(y, m + 1, 1) - EAT_MS) };
}

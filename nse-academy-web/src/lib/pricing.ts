export type SubscriptionPlan = "intermediary" | "premium";
export type BillingMonths = 1 | 3 | 6 | 12;

export const PLAN_PRICES_KES: Record<SubscriptionPlan, number> = {
  intermediary: 300,
  premium: 500,
};

// Longer prepaid terms earn a bigger discount - 1 month is full price.
// Must match nse-academy-api/src/payments/payments.service.ts's
// DISCOUNT_BY_MONTHS exactly, since this only renders what the backend
// actually charges - it isn't a separate source of truth.
export const DISCOUNT_BY_MONTHS: Record<BillingMonths, number> = {
  1: 0,
  3: 0.05,
  6: 0.1,
  12: 0.15,
};

export const BILLING_MONTHS_OPTIONS: BillingMonths[] = [1, 3, 6, 12];

export function computeTotalKes(plan: SubscriptionPlan, months: BillingMonths): number {
  const base = PLAN_PRICES_KES[plan] * months;
  return Math.round(base * (1 - DISCOUNT_BY_MONTHS[months]));
}

export function computeFullPriceKes(plan: SubscriptionPlan, months: BillingMonths): number {
  return PLAN_PRICES_KES[plan] * months;
}

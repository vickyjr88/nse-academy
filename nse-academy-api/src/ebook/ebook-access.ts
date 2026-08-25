/**
 * Tier-based ebook access:
 *  - intermediary: only the NSE Trading Guide
 *  - premium: all ebooks (null = unrestricted)
 *
 * Encoding used by getStatus / the web app:
 *  - null      → all ebooks (active premium)
 *  - string[]  → those product IDs (active intermediary, or [] for none)
 * Never return JS `undefined` and never coalesce empty access to `null` -
 * the frontend treats `null` as "all products".
 */

export const TRADING_GUIDE_PRODUCT_ID = '4c379aa9-2035-47d8-b8fd-bacc860eea7c';
export const MAX_GUEST_DOWNLOADS = 2;

export const TIER_EBOOK_ACCESS: Record<string, string[] | null> = {
  intermediary: [TRADING_GUIDE_PRODUCT_ID],
  premium: null,
};

export function tierGrantsAccess(tier: string, productId: string): boolean {
  const allowed = TIER_EBOOK_ACCESS[tier];
  if (allowed === undefined) return false;
  if (allowed === null) return true;
  return allowed.includes(productId);
}

/**
 * @returns null if the active tier includes every ebook; otherwise the list
 * of product IDs (empty when the user has no subscriber access).
 */
export function subscriberAccessProducts(
  tier: string | null | undefined,
  isActive: boolean,
): string[] | null {
  if (!isActive || !tier) return [];
  const allowed = TIER_EBOOK_ACCESS[tier];
  if (allowed === undefined) return [];
  return allowed;
}

export function hasSubscriberAccess(
  products: string[] | null | undefined,
  productId: string,
): boolean {
  if (products === null) return true;
  if (Array.isArray(products)) return products.includes(productId);
  return false;
}

export function checkoutPathFor(productId: string): string {
  return `/ebooks/buy/${productId}`;
}

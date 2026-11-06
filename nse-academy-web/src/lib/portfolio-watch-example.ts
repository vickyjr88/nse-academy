// The illustrative Portfolio Watch shown on the pricing page. The prices are the latest real NSE closes and the flags
// come from the same rules that run for members; the shares and costs are invented. Server-side only.

export interface PortfolioWatchExample {
  asOf: string;
  asOfLabel: string;
  valueKes: number;
  dayChangeKes: number;
  dayChangePct: number | null;
  unrealizedKes: number | null;
  unrealizedPct: number | null;
  items: { kind: string; ticker: string; text: string }[];
  holdings: { ticker: string; quantity: number; price: number; dayChangePct: number | null; valueKes: number; gainPct: number | null }[];
  illustrative: true;
}

/** null on any failure: the pricing page must still render without the example. */
export async function getPortfolioWatchExample(): Promise<PortfolioWatchExample | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/portfolio-watch/example`, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const data = (await res.json()) as PortfolioWatchExample;
    return Array.isArray(data?.holdings) && data.holdings.length > 0 ? data : null;
  } catch {
    return null;
  }
}

export interface MarketQuote {
  ticker: string;
  name: string;
  price: number;
  change: string;
  volume: string;
  updatedAt?: string;
}

/** Latest delayed quote for a ticker, or null on any failure - a missing price must never break a company page. */
export async function getMarketQuote(ticker: string): Promise<MarketQuote | null> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/public/market-data/${encodeURIComponent(ticker.toUpperCase())}`, { next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as MarketQuote) : null;
  } catch {
    return null;
  }
}

/** Fixed Nairobi time so the server render and the browser agree. */
export function formatQuoteTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

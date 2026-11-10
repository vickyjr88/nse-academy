// Public (unauthenticated) research notes - safe to import from Server Components.

export interface StockFactsRow {
  ticker: string;
  name: string;
  sector: string | null;
  asOf: string;
  price: number;
  ret1mPct: number | null;
  ret3mPct: number | null;
  high60: number;
  low60: number;
  fromHighPct: number;
  fromLowPct: number;
  volatilityPct: number;
  avgDailyValueKes: number;
}

export interface ResearchSummary {
  id: string;
  kind: "FOCUS_LIST" | "BRIEF";
  slug: string;
  title: string;
  summary: string;
  tickers: string[];
  period: string | null;
  reviewedBy: string | null;
  publishedAt: string | null;
}

export interface ResearchNote extends ResearchSummary {
  body: string;
  facts: { asOf?: string; universe?: number; minAvgValueKes?: number; stocks?: StockFactsRow[] };
}

const REVALIDATE_SECONDS = 600;

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

export async function listResearch(kind?: "FOCUS_LIST" | "BRIEF"): Promise<ResearchSummary[]> {
  try {
    const res = await fetch(apiUrl(`/public/research${kind ? `?kind=${kind}` : ""}`), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

export async function getResearchNote(slug: string): Promise<ResearchNote | null> {
  if (!/^[a-z0-9.-]{1,80}$/.test(slug)) return null;
  try {
    const res = await fetch(apiUrl(`/public/research/${slug}`), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** The published brief for a company, or null. A company page must render without it. */
export async function getBriefFor(ticker: string): Promise<ResearchSummary | null> {
  if (!/^[A-Za-z0-9.]{1,12}$/.test(ticker)) return null;
  try {
    const res = await fetch(apiUrl(`/public/research/brief/${ticker.toLowerCase()}`), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

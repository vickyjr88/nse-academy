// Public (unauthenticated) model portfolio fetches - safe to import from Server Components.

export interface ModelHolding {
  ticker: string;
  weightPct: number;
  rationale: string | null;
}

export interface ModelPerformance {
  inceptionDate: string;
  asOf: string;
  sincePct: number;
  last30Pct: number | null;
  series: { date: string; value: number }[];
  missing: string[];
}

export interface ModelPortfolio {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  riskProfile: string | null;
  reviewedBy: string | null;
  inceptionDate: string;
  publishedAt: string | null;
  holdings: ModelHolding[];
  performance: ModelPerformance | null;
}

const REVALIDATE_SECONDS = 600;

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

export const RISK_LABELS: Record<string, string> = {
  conservative: "Conservative",
  moderate: "Moderate",
  aggressive: "Aggressive",
  dividend: "Dividend-focused",
  growth: "Growth",
};

export async function listModelPortfolios(): Promise<{ note: string; data: ModelPortfolio[] }> {
  try {
    const res = await fetch(apiUrl("/public/model-portfolios"), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? await res.json() : { note: "", data: [] };
  } catch {
    return { note: "", data: [] };
  }
}

export async function getModelPortfolio(slug: string): Promise<{ note: string; model: ModelPortfolio } | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  try {
    const res = await fetch(apiUrl(`/public/model-portfolios/${slug}`), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

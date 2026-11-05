// Public (unauthenticated) market report endpoints - safe to import from Server Components,
// OG-image routes and route handlers. Shapes mirror the API's PublicMarketReport.

export interface MoverFact {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  valueKes: number;
  volume: number;
}

export interface MarketFacts {
  sessionYmd: string;
  label: string;
  shortLabel: string;
  breadth: { advancers: number; decliners: number; unchanged: number; traded: number };
  valueTradedKes: number;
  avgValueTradedKes: number | null;
  valueVsAvgPct: number | null;
  valueVsAvgNote: string | null;
  previous: { sessionYmd: string; advancers: number; decliners: number; valueTradedKes: number } | null;
  gainers: MoverFact[];
  losers: MoverFact[];
  active: MoverFact[];
  volumeSpikes: { ticker: string; name: string; valueKes: number; baselineKes: number; multiple: number; changePct: number }[];
  limitMoves: { ticker: string; name: string; changePct: number; price: number }[];
  sectors: { sector: string; changePct: number; valueKes: number; stocks: number }[];
  concentration: { ticker: string; name: string; sharePct: number } | null;
}

export interface MarketReport {
  sessionYmd: string;
  label: string;
  url: string;
  headline: string;
  summary: string;
  story: string[];
  lessons: { title: string; body: string }[];
  facts: MarketFacts;
  share: { xPost: string; xThread: string[]; whatsapp: string; caption: string; hashtags: string[] };
  aiGenerated: boolean;
  aiModel: string | null;
  publishedAt: string | null;
}

export interface MarketReportSummary {
  sessionYmd: string;
  label: string;
  headline: string;
  summary: string;
  breadth: MarketFacts["breadth"];
  valueTradedKes: number;
  topGainer: { ticker: string; changePct: number } | null;
  topLoser: { ticker: string; changePct: number } | null;
  aiGenerated: boolean;
}

// Reports are published once a day and never change after, so a few minutes of caching is plenty.
const REVALIDATE_SECONDS = 300;

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

/** null for "not found" and for any failure - a missing report page must never take the site down. */
export async function getMarketReport(ymd: string): Promise<MarketReport | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  try {
    const res = await fetch(apiUrl(`/public/market-reports/${ymd}`), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as MarketReport) : null;
  } catch {
    return null;
  }
}

export async function getLatestMarketReport(): Promise<MarketReport | null> {
  try {
    const res = await fetch(apiUrl("/public/market-reports/latest"), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as MarketReport) : null;
  } catch {
    return null;
  }
}

export async function listMarketReports(limit = 30): Promise<MarketReportSummary[]> {
  try {
    const res = await fetch(apiUrl(`/public/market-reports?limit=${limit}`), { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as MarketReportSummary[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- formatting

/** 1031225725 -> "KSh 1.03B"; 356286851 -> "KSh 356.3M"; 48300 -> "KSh 48.3K" */
export function fmtKes(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `KSh ${+(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `KSh ${+(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `KSh ${+(n / 1e3).toFixed(1)}K`;
  return `KSh ${Math.round(n)}`;
}

export function fmtPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${+(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtPrice(n: number): string {
  return n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The reel/story cards, in order. */
export const CARD_SLIDES = 5;

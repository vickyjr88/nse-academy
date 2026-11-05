import { getAccessToken } from "@/lib/ebook";

export interface WatchItem {
  kind: "TAKE_PROFIT" | "DRAWDOWN" | "NEAR_HIGH" | "NEAR_LOW" | "CONCENTRATION" | "MOVER";
  ticker: string;
  key: string;
  text: string;
}

export interface WatchResult {
  asOf: string | null;
  valueKes: number;
  dayChangeKes: number;
  dayChangePct: number | null;
}

export interface PortfolioWatch {
  enabled: boolean;
  result: WatchResult | null;
  fresh: WatchItem[];
}

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function headers(): HeadersInit {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** null when the plan does not include portfolio watch (Premium). */
export async function getPortfolioWatch(): Promise<PortfolioWatch | null> {
  const res = await fetch(apiUrl("/portfolio-watch"), { headers: headers() });
  if (res.status === 403) return null;
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export async function setPortfolioWatchEnabled(enabled: boolean): Promise<void> {
  const res = await fetch(apiUrl("/portfolio-watch/settings"), { method: "PUT", headers: headers(), body: JSON.stringify({ enabled }) });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

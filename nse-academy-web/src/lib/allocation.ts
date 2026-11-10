import { getAccessToken } from "@/lib/ebook";

export interface AllocationRow {
  ticker: string;
  sector: string | null;
  quantity: number;
  price: number;
  valueKes: number;
  weightPct: number;
}

export interface SectorRow {
  sector: string;
  valueKes: number;
  weightPct: number;
  tickers: string[];
}

export interface Target {
  ticker: string;
  weightPct: number;
}

export interface AllocationOverview {
  valueKes: number;
  rows: AllocationRow[];
  sectors: SectorRow[];
  unpriced: string[];
  notes: string[];
  targets: Target[];
}

export interface DriftRow {
  ticker: string;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  valueKes: number;
}

export interface Trade {
  ticker: string;
  action: "BUY" | "SELL";
  shares: number;
  priceKes: number;
  valueKes: number;
  feeKes: number | null;
  brokerName: string | null;
  fromPct: number;
  toPct: number;
}

export interface RebalancePlan {
  baseKes: number;
  drift: DriftRow[];
  trades: Trade[];
  unassigned: { ticker: string; valueKes: number }[];
  netCashKes: number;
  totalFeesKes: number;
  feesPctOfBase: number;
  warnings: string[];
  targets: Target[];
}

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function headers(): HeadersInit {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getAllocation(): Promise<AllocationOverview> {
  return fetch(apiUrl("/allocation"), { headers: headers() }).then((r) => handle<AllocationOverview>(r));
}

export function saveTargets(targets: Target[]): Promise<Target[]> {
  return fetch(apiUrl("/allocation/targets"), { method: "PUT", headers: headers(), body: JSON.stringify({ targets }) }).then((r) => handle<Target[]>(r));
}

export function getRebalance(cashKes: number): Promise<RebalancePlan> {
  return fetch(apiUrl(`/allocation/rebalance?cash=${encodeURIComponent(String(cashKes || 0))}`), { headers: headers() }).then((r) => handle<RebalancePlan>(r));
}

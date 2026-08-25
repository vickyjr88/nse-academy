import { getAccessToken } from "@/lib/ebook";
import type { Broker } from "@/lib/journal";

export interface RealizedGain {
  id: string;
  userId: string;
  tradeId: string;
  brokerId: string;
  broker: Broker;
  ticker: string;
  companyName: string | null;
  quantity: number;
  proceedsKes: number;
  costBasisKes: number;
  realizedGainKes: number;
  tradeDate: string;
  createdAt: string;
}

export interface RealizedGainByTicker {
  ticker: string;
  realizedGainKes: number;
  proceedsKes: number;
  costBasisKes: number;
  tradeCount: number;
}

export interface RealizedGainsSummary {
  totalRealizedGainKes: number;
  byTicker: RealizedGainByTicker[];
  trades: Omit<RealizedGain, "broker">[];
}

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function authHeaders(): HeadersInit {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export function getRealizedGainsSummary(year?: number): Promise<RealizedGainsSummary> {
  const qs = year ? `?year=${year}` : "";
  return fetch(apiUrl(`/journal/realized-gains${qs}`), { headers: authHeaders() }).then((r) =>
    handle<RealizedGainsSummary>(r),
  );
}

export function listRealizedGains(): Promise<RealizedGain[]> {
  return fetch(apiUrl("/journal/realized-gains/trades"), { headers: authHeaders() }).then((r) =>
    handle<RealizedGain[]>(r),
  );
}

import { getAccessToken } from "@/lib/ebook";
import type { Broker } from "@/lib/journal";

export interface Dividend {
  id: string;
  userId: string;
  brokerId: string;
  broker: Broker;
  ticker: string;
  companyName: string | null;
  amountKes: number;
  paymentDate: string;
  source: "MANUAL" | "CDSC_IMPORT";
  notes: string | null;
  createdAt: string;
}

export interface CreateDividendInput {
  brokerId: string;
  ticker: string;
  companyName?: string;
  amountKes: number;
  paymentDate: string;
  notes?: string;
}

export interface YieldOnCost {
  ticker: string;
  companyName: string | null;
  annualDividendsKes: number;
  costBasisKes: number;
  yieldOnCostPct: number;
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

export function listDividends(): Promise<Dividend[]> {
  return fetch(apiUrl("/journal/dividends"), { headers: authHeaders() }).then((r) =>
    handle<Dividend[]>(r),
  );
}

export function createDividend(input: CreateDividendInput): Promise<Dividend> {
  return fetch(apiUrl("/journal/dividends"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle<Dividend>(r));
}

export function updateDividend(id: string, input: Partial<CreateDividendInput>): Promise<Dividend> {
  return fetch(apiUrl(`/journal/dividends/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle<Dividend>(r));
}

export function deleteDividend(id: string): Promise<{ success: boolean }> {
  return fetch(apiUrl(`/journal/dividends/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  }).then((r) => handle<{ success: boolean }>(r));
}

export function getYieldOnCost(): Promise<YieldOnCost[]> {
  return fetch(apiUrl("/journal/dividends/yield-on-cost"), { headers: authHeaders() }).then((r) =>
    handle<YieldOnCost[]>(r),
  );
}

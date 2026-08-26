import { getAccessToken } from "@/lib/ebook";

export interface Broker {
  id: string;
  name: string;
  cdaCode: string | null;
  feePercent: number;
  cdsRequired: boolean;
}

export interface Trade {
  id: string;
  userId: string;
  brokerId: string;
  broker: Broker;
  ticker: string;
  companyName: string | null;
  side: "BUY" | "SELL";
  quantity: number;
  pricePerShare: number;
  feesKes: number;
  totalKes: number;
  tradeDate: string;
  notes: string | null;
  source: "MANUAL" | "CDSC_IMPORT";
  createdAt: string;
}

export interface PortfolioPosition {
  ticker: string;
  companyName: string | null;
  broker: { id: string; name: string };
  quantity: number;
  avgCost: number | null;
  costBasisKes: number | null;
  currentPrice: number | null;
  marketValueKes: number | null;
  unrealizedGainKes: number | null;
}

export interface ConsolidatedPosition {
  ticker: string;
  companyName: string | null;
  quantity: number;
  avgCost: number | null;
  costBasisKes: number | null;
  currentPrice: number | null;
  marketValueKes: number | null;
  unrealizedGainKes: number | null;
}

export interface Portfolio {
  positions: PortfolioPosition[];
  consolidated: ConsolidatedPosition[];
  totalCostBasisKes: number;
  totalMarketValueKes: number;
  totalUnrealizedGainKes: number;
}

export interface StatementImportRecord {
  id: string;
  filename: string;
  accountNo: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  holdingsRead: number;
  status: "completed" | "failed";
  error: string | null;
  createdAt: string;
}

export interface CreateTradeInput {
  brokerId: string;
  ticker: string;
  companyName?: string;
  side: "BUY" | "SELL";
  quantity: number;
  pricePerShare: number;
  feesKes?: number;
  tradeDate: string;
  notes?: string;
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

export function listBrokers(): Promise<Broker[]> {
  return fetch(apiUrl("/brokers")).then((r) => handle<Broker[]>(r));
}

export interface PaginatedTrades {
  data: Trade[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function listTrades(params?: { page?: number; limit?: number }): Promise<PaginatedTrades> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return fetch(apiUrl(`/journal/trades?${qs.toString()}`), { headers: authHeaders() }).then((r) =>
    handle<PaginatedTrades>(r),
  );
}

export function createTrade(input: CreateTradeInput): Promise<Trade> {
  return fetch(apiUrl("/journal/trades"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle<Trade>(r));
}

export function updateTrade(id: string, input: Partial<CreateTradeInput>): Promise<Trade> {
  return fetch(apiUrl(`/journal/trades/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle<Trade>(r));
}

export function deleteTrade(id: string): Promise<{ success: boolean }> {
  return fetch(apiUrl(`/journal/trades/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  }).then((r) => handle<{ success: boolean }>(r));
}

export function getPortfolio(): Promise<Portfolio> {
  return fetch(apiUrl("/journal/portfolio"), { headers: authHeaders() }).then((r) =>
    handle<Portfolio>(r),
  );
}

export function importStatement(file: File): Promise<StatementImportRecord> {
  const formData = new FormData();
  formData.append("file", file);
  return fetch(apiUrl("/journal/statements/import"), {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  }).then((r) => handle<StatementImportRecord>(r));
}

export function listStatementImports(): Promise<StatementImportRecord[]> {
  return fetch(apiUrl("/journal/statements"), { headers: authHeaders() }).then((r) =>
    handle<StatementImportRecord[]>(r),
  );
}

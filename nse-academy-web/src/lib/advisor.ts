import { getAccessToken } from "@/lib/ebook";

export interface AdvisorProfile {
  id: string;
  userId: string;
  orgId: string | null;
  headline: string;
  bio: string;
  specialties: string[];
  credentials: string | null;
  photoUrl: string | null;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
  user?: { name: string };
}

export interface AdvisorClientRow {
  id: string;
  advisorId: string;
  userId: string;
  status: "pending" | "accepted" | "declined";
  source: "request" | "org_member";
  requestedAt: string;
  respondedAt: string | null;
  user?: { id: string; name: string; email: string };
  advisor?: AdvisorProfile;
}

export interface AdvisorQuery {
  id: string;
  advisorId: string;
  userId: string;
  question: string;
  reply: string | null;
  status: "open" | "answered";
  createdAt: string;
  answeredAt: string | null;
  user?: { id: string; name: string; email: string };
  advisor?: AdvisorProfile;
}

export interface AdvisorInsight {
  id: string;
  advisorId: string;
  title: string;
  body: string;
  tickers: string[];
  emailedAt: string | null;
  createdAt: string;
  advisor?: AdvisorProfile;
}

export interface AdvisorAlert {
  id: string;
  advisorId: string;
  ticker: string;
  action: "BUY" | "SELL";
  message: string;
  recipientCount: number;
  createdAt: string;
}

export interface HoldingRow {
  ticker: string;
  companyName: string | null;
  quantity: number;
  avgCost: number | null;
  costBasisKes: number | null;
  currentPrice: number | null;
  marketValueKes: number | null;
  unrealizedGainKes: number | null;
}

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  investorProfile: {
    type: string;
    riskScore: number;
    horizonYears: number;
    capitalRange: string;
  } | null;
  lessonsCompleted: number;
  portfolio: {
    totalMarketValueKes: number;
    totalCostBasisKes: number;
    totalUnrealizedGainKes: number;
    holdingsCount: number;
    holdings: HoldingRow[];
  };
  totalRealizedGainKes: number;
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

// Public (unauthenticated) advisor lookups live in lib/advisor-public.ts,
// not here - that file has no dependency on lib/ebook.ts, so it can be
// imported from Server Components (e.g. the public /advisors pages)
// without pulling in the client-only useSyncExternalStore-based token hook
// this file depends on for every authenticated call below.

// Authenticated

export function registerAsAdvisor(input: {
  headline: string;
  bio: string;
  specialties?: string[];
  credentials?: string;
  photoUrl?: string;
}): Promise<AdvisorProfile> {
  return fetch(apiUrl("/financial-advisor/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle(r));
}

export function getMyAdvisorProfile(): Promise<AdvisorProfile | null> {
  return fetch(apiUrl("/financial-advisor/me"), { headers: authHeaders() }).then((r) => handle(r));
}

export function updateAdvisorProfile(input: Partial<{
  headline: string;
  bio: string;
  specialties: string[];
  credentials: string;
  photoUrl: string;
  isPublic: boolean;
}>): Promise<AdvisorProfile> {
  return fetch(apiUrl("/financial-advisor/profile"), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle(r));
}

export function requestConnection(advisorId: string): Promise<AdvisorClientRow> {
  return fetch(apiUrl(`/financial-advisor/connect/${advisorId}`), {
    method: "POST",
    headers: authHeaders(),
  }).then((r) => handle(r));
}

export function listMyConnections(): Promise<AdvisorClientRow[]> {
  return fetch(apiUrl("/financial-advisor/connections"), { headers: authHeaders() }).then((r) => handle(r));
}

export function respondToConnection(clientRowId: string, accept: boolean): Promise<AdvisorClientRow> {
  return fetch(apiUrl(`/financial-advisor/clients/${clientRowId}/respond`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ accept }),
  }).then((r) => handle(r));
}

export function listMyClients(status?: string): Promise<AdvisorClientRow[]> {
  const qs = status ? `?status=${status}` : "";
  return fetch(apiUrl(`/financial-advisor/clients${qs}`), { headers: authHeaders() }).then((r) => handle(r));
}

export function getClientProfile(userId: string): Promise<ClientProfile> {
  return fetch(apiUrl(`/financial-advisor/clients/${userId}`), { headers: authHeaders() }).then((r) => handle(r));
}

export function submitQuery(advisorId: string, question: string): Promise<AdvisorQuery> {
  return fetch(apiUrl("/financial-advisor/queries"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ advisorId, question }),
  }).then((r) => handle(r));
}

export function listQueriesForAdvisor(status?: string): Promise<AdvisorQuery[]> {
  const qs = status ? `?status=${status}` : "";
  return fetch(apiUrl(`/financial-advisor/queries${qs}`), { headers: authHeaders() }).then((r) => handle(r));
}

export function listMyQueries(): Promise<AdvisorQuery[]> {
  return fetch(apiUrl("/financial-advisor/queries/mine"), { headers: authHeaders() }).then((r) => handle(r));
}

export function answerQuery(id: string, reply: string): Promise<AdvisorQuery> {
  return fetch(apiUrl(`/financial-advisor/queries/${id}/answer`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ reply }),
  }).then((r) => handle(r));
}

export function publishInsight(input: { title: string; body: string; tickers?: string[] }): Promise<AdvisorInsight> {
  return fetch(apiUrl("/financial-advisor/insights"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle(r));
}

export function listMyInsights(): Promise<AdvisorInsight[]> {
  return fetch(apiUrl("/financial-advisor/insights"), { headers: authHeaders() }).then((r) => handle(r));
}

export function listInsightsFeed(): Promise<AdvisorInsight[]> {
  return fetch(apiUrl("/financial-advisor/insights/feed"), { headers: authHeaders() }).then((r) => handle(r));
}

export function sendAlert(input: { ticker: string; action: "BUY" | "SELL"; message: string }): Promise<AdvisorAlert> {
  return fetch(apiUrl("/financial-advisor/alerts"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle(r));
}

export function listMyAlerts(): Promise<AdvisorAlert[]> {
  return fetch(apiUrl("/financial-advisor/alerts"), { headers: authHeaders() }).then((r) => handle(r));
}

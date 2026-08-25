import { getAccessToken } from "@/lib/ebook";

export interface PriceAlert {
  id: string;
  userId: string;
  ticker: string;
  targetPrice: number;
  direction: "ABOVE" | "BELOW";
  status: "pending" | "triggered" | "cancelled";
  createdAt: string;
  triggeredAt: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreateAlertInput {
  ticker: string;
  targetPrice: number;
  direction: "ABOVE" | "BELOW";
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

export function listAlerts(): Promise<PriceAlert[]> {
  return fetch(apiUrl("/alerts"), { headers: authHeaders() }).then((r) => handle<PriceAlert[]>(r));
}

export function createAlert(input: CreateAlertInput): Promise<PriceAlert> {
  return fetch(apiUrl("/alerts"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(input),
  }).then((r) => handle<PriceAlert>(r));
}

export function deleteAlert(id: string): Promise<{ success: boolean }> {
  return fetch(apiUrl(`/alerts/${id}`), {
    method: "DELETE",
    headers: authHeaders(),
  }).then((r) => handle<{ success: boolean }>(r));
}

export function listNotifications(): Promise<Notification[]> {
  return fetch(apiUrl("/notifications"), { headers: authHeaders() }).then((r) =>
    handle<Notification[]>(r),
  );
}

export function markNotificationRead(id: string): Promise<Notification> {
  return fetch(apiUrl(`/notifications/${id}/read`), {
    method: "PATCH",
    headers: authHeaders(),
  }).then((r) => handle<Notification>(r));
}

export function markAllRead(): Promise<{ success: boolean }> {
  return fetch(apiUrl("/notifications/read-all"), {
    method: "POST",
    headers: authHeaders(),
  }).then((r) => handle<{ success: boolean }>(r));
}

export function getUnreadCount(): Promise<{ count: number }> {
  return fetch(apiUrl("/notifications/unread-count"), { headers: authHeaders() }).then((r) =>
    handle<{ count: number }>(r),
  );
}

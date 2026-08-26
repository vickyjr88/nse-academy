// Public (unauthenticated) advisor endpoints - safe to import from Server Components.
// Kept separate from lib/advisor.ts because that file also exports client-only
// helpers that pull in lib/ebook.ts's useSyncExternalStore-based token hook,
// which Next.js refuses to bundle into a Server Component module graph.
import type { AdvisorProfile } from "./advisor";

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listPublicAdvisors(params?: { page?: number; limit?: number; specialty?: string }): Promise<{
  data: AdvisorProfile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.specialty) qs.set("specialty", params.specialty);
  try {
    const res = await fetch(apiUrl(`/financial-advisors?${qs.toString()}`), { next: { revalidate: 60 } });
    return await handle(res);
  } catch {
    return { data: [], total: 0, page: params?.page ?? 1, limit: params?.limit ?? 20, totalPages: 0 };
  }
}

export function getPublicAdvisor(id: string): Promise<AdvisorProfile> {
  return fetch(apiUrl(`/financial-advisors/${id}`), { next: { revalidate: 60 } }).then((r) => handle(r));
}

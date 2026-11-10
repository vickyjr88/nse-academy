import { getAccessToken } from "@/lib/ebook";

export interface ModelComparison {
  slug: string;
  name: string;
  hasHoldings: boolean;
  overlapPct: number;
  rows: { ticker: string; modelPct: number; yourPct: number; diffPct: number }[];
  notInModel: { ticker: string; weightPct: number }[];
}

function headers(): HeadersInit {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export function compareWithModel(slug: string): Promise<ModelComparison> {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/model-portfolios/${slug}/compare`, { headers: headers() }).then((r) => handle<ModelComparison>(r));
}

export function adoptModelAsTargets(slug: string): Promise<{ slug: string }> {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}/model-portfolios/${slug}/use-as-targets`, { method: "POST", headers: headers() }).then((r) => handle<{ slug: string }>(r));
}

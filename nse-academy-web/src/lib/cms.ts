const CMS_URL = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:1337";
const CMS_TOKEN = process.env.CMS_API_TOKEN || "";

const headers: Record<string, string> = CMS_TOKEN
  ? { Authorization: `Bearer ${CMS_TOKEN}` }
  : {};

export interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  category: string;
  author_name: string;
  read_time_minutes: number;
  tags: string[] | null;
  investor_types: string[] | null;
  is_premium: boolean;
  og_image_url: string | null;
  cover_image: { url: string; alternativeText: string | null } | null;
  publishedAt: string;
  createdAt: string;
  is_sponsored: boolean;
  sponsor_name: string | null;
  sponsor_logo_url: string | null;
  sponsor_url: string | null;
  sponsor_cta: string | null;
}

function mapArticle(raw: any): Article {
  const a = raw.attributes ?? raw;
  return {
    id: raw.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt ?? null,
    body: a.body ?? "",
    category: a.category ?? "NSE News",
    author_name: a.author_name ?? "NSE Academy",
    read_time_minutes: a.read_time_minutes ?? 5,
    tags: a.tags ?? null,
    investor_types: a.investor_types ?? null,
    is_premium: a.is_premium ?? false,
    og_image_url: a.og_image_url ?? null,
    cover_image: a.cover_image?.data?.attributes
      ? { url: a.cover_image.data.attributes.url, alternativeText: a.cover_image.data.attributes.alternativeText }
      : null,
    publishedAt: a.publishedAt ?? a.createdAt,
    createdAt: a.createdAt,
    is_sponsored: a.is_sponsored ?? false,
    sponsor_name: a.sponsor_name ?? null,
    sponsor_logo_url: a.sponsor_logo_url ?? null,
    sponsor_url: a.sponsor_url ?? null,
    sponsor_cta: a.sponsor_cta ?? null,
  };
}

export async function getArticles(params?: {
  category?: string;
  limit?: number;
  page?: number;
}): Promise<{ articles: Article[]; total: number; pageCount: number }> {
  const qs = new URLSearchParams({
    "pagination[page]": String(params?.page ?? 1),
    "pagination[pageSize]": String(params?.limit ?? 12),
    "sort[0]": "publishedAt:desc",
    "populate[cover_image]": "true",
    ...(params?.category ? { "filters[category][$eq]": params.category } : {}),
  });

  try {
    const res = await fetch(`${CMS_URL}/api/articles?${qs}`, {
      headers,
      next: { revalidate: 60 },
    });

    if (!res.ok) return { articles: [], total: 0, pageCount: 0 };

    const json = await res.json();
    const articles = (json.data ?? []).map(mapArticle);
    return {
      articles,
      total: json.meta?.pagination?.total ?? 0,
      pageCount: json.meta?.pagination?.pageCount ?? 1,
    };
  } catch (error) {
    console.warn("CMS Fetch (getArticles) failed:", error);
    return { articles: [], total: 0, pageCount: 0 };
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const qs = new URLSearchParams({
    "filters[slug][$eq]": slug,
    "populate[cover_image]": "true",
  });

  try {
    const res = await fetch(`${CMS_URL}/api/articles?${qs}`, {
      headers,
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const item = json.data?.[0];
    return item ? mapArticle(item) : null;
  } catch (error) {
    console.warn(`CMS Fetch (getArticleBySlug: ${slug}) failed:`, error);
    return null;
  }
}

export async function getAllArticleSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${CMS_URL}/api/articles?fields[0]=slug&pagination[limit]=200`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []).map((a: any) => a.attributes?.slug ?? a.slug).filter(Boolean);
  } catch (error) {
    console.warn("CMS Fetch (getAllArticleSlugs) failed:", error);
    return [];
  }
}

export const CATEGORIES = [
  "NSE News",
  "Weekly Roundup",
  "Daily Update",
  "Market Analysis",
  "Stock Deep Dive",
  "IPO Watch",
  "Investor Education",
] as const;

export type Category = typeof CATEGORIES[number];

export interface StockProfile {
  id: number;
  ticker: string;
  company_name: string;
  sector: string;
  description: string;
  dividend_yield: number | null;
  risk_level: "low" | "medium" | "high";
  investor_types: string[] | null;
}

function mapStockProfile(raw: any): StockProfile {
  const a = raw.attributes ?? raw;
  return {
    id: raw.id,
    ticker: a.ticker,
    company_name: a.company_name,
    sector: a.sector,
    description: a.description ?? "",
    dividend_yield: a.dividend_yield ?? null,
    risk_level: a.risk_level ?? "medium",
    investor_types: a.investor_types ?? [],
  };
}

export async function getStockProfiles(params?: { limit?: number; page?: number }): Promise<{ profiles: StockProfile[]; total: number; pageCount: number }> {
  const qs = new URLSearchParams({
    "pagination[page]": String(params?.page ?? 1),
    "pagination[pageSize]": String(params?.limit ?? 100),
    "sort[0]": "ticker:asc",
  });

  try {
    const res = await fetch(`${CMS_URL}/api/stock-profiles?${qs}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { profiles: [], total: 0, pageCount: 0 };

    const json = await res.json();
    const profiles = (json.data ?? []).map(mapStockProfile);
    return {
      profiles,
      total: json.meta?.pagination?.total ?? 0,
      pageCount: json.meta?.pagination?.pageCount ?? 1,
    };
  } catch (error) {
    console.warn("CMS Fetch (getStockProfiles) failed:", error);
    return { profiles: [], total: 0, pageCount: 0 };
  }
}

export async function getStockProfileByTicker(ticker: string): Promise<StockProfile | null> {
  const qs = new URLSearchParams({
    "filters[ticker][$eq]": ticker,
  });

  try {
    const res = await fetch(`${CMS_URL}/api/stock-profiles?${qs}`, {
      headers,
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const item = json.data?.[0];
    return item ? mapStockProfile(item) : null;
  } catch (error) {
    console.warn(`CMS Fetch (getStockProfileByTicker: ${ticker}) failed:`, error);
    return null;
  }
}

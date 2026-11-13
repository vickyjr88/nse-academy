import type { MetadataRoute } from "next";
import { getAllArticleEntries, getStockProfiles } from "@/lib/cms";
import { listPublicAdvisors } from "@/lib/advisor-public";
import { listMarketReports } from "@/lib/market-report";
import { listModelPortfolios } from "@/lib/model-portfolios";
import { listResearch } from "@/lib/research";

import { SITE_URL } from "@/lib/seo";

interface PublicSlug {
  slug: string;
  updatedAt: string;
}

async function getPublicProfileSlugs(): Promise<PublicSlug[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return [];
  try {
    const res = await fetch(`${apiBase}/profiler/public-slugs`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return (await res.json()) as PublicSlug[];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, profileSlugs, { profiles: companies }, { data: advisors }, reports, { data: models }, research] = await Promise.all([
    getAllArticleEntries(),
    getPublicProfileSlugs(),
    getStockProfiles({ limit: 100 }),
    listPublicAdvisors({ limit: 100 }),
    listMarketReports(100),
    listModelPortfolios(),
    listResearch(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/store`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/calculators`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/glossary`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/investor-profiler`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/companies`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/advisors`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/market-report`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/research`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/model-portfolios`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/brokers-compare`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/delete-account`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const articlePages: MetadataRoute.Sitemap = articles.map(({ slug, updatedAt }) => ({
    url: `${SITE_URL}/blog/${slug}`,
    ...(updatedAt && { lastModified: new Date(updatedAt) }),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const profilePages: MetadataRoute.Sitemap = profileSlugs.map(({ slug, updatedAt }) => ({
    url: `${SITE_URL}/p/${slug}`,
    lastModified: new Date(updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const companyPages: MetadataRoute.Sitemap = companies.map(({ ticker }) => ({
    url: `${SITE_URL}/companies/${ticker.toUpperCase()}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const advisorPages: MetadataRoute.Sitemap = advisors.map((a) => ({
    url: `${SITE_URL}/advisors/${a.id}`,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const reportPages: MetadataRoute.Sitemap = reports.map((r) => ({
    url: `${SITE_URL}/market-report/${r.sessionYmd}`,
    lastModified: new Date(`${r.sessionYmd}T12:00:00+03:00`),
    changeFrequency: "never" as const,
    priority: 0.6,
  }));

  const modelPages: MetadataRoute.Sitemap = models.map((m) => ({
    url: `${SITE_URL}/model-portfolios/${m.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const researchPages: MetadataRoute.Sitemap = research.map((n) => ({
    url: `${SITE_URL}/research/${n.slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...articlePages, ...profilePages, ...companyPages, ...advisorPages, ...reportPages, ...modelPages, ...researchPages];
}

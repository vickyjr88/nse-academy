import type { MetadataRoute } from "next";
import { getAllArticleSlugs, getStockProfiles } from "@/lib/cms";
import { listPublicAdvisors } from "@/lib/advisor-public";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net');

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
  const [articleSlugs, profileSlugs, { profiles: companies }, { data: advisors }] = await Promise.all([
    getAllArticleSlugs(),
    getPublicProfileSlugs(),
    getStockProfiles({ limit: 100 }),
    listPublicAdvisors({ limit: 100 }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/store`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/calculators`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/glossary`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/investor-profiler`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/companies`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/advisors`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/brokers-compare`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  const articlePages: MetadataRoute.Sitemap = articleSlugs.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: new Date(),
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
    url: `${SITE_URL}/companies/${ticker}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const advisorPages: MetadataRoute.Sitemap = advisors.map((a) => ({
    url: `${SITE_URL}/advisors/${a.id}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...articlePages, ...profilePages, ...companyPages, ...advisorPages];
}

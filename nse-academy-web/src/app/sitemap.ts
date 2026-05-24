import type { MetadataRoute } from "next";
import { getAllArticleSlugs } from "@/lib/cms";

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
  const [articleSlugs, profileSlugs] = await Promise.all([
    getAllArticleSlugs(),
    getPublicProfileSlugs(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/calculators`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/auth/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/auth/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/glossary`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/investor-profiler`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
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

  return [...staticPages, ...articlePages, ...profilePages];
}

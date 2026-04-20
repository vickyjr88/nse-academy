import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getArticleBySlug, getAllArticleSlugs, getArticles } from "@/lib/cms";

// ---------------------------------------------------------------------------
// Static generation
// ---------------------------------------------------------------------------

export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export const revalidate = 60;

// ---------------------------------------------------------------------------
// Dynamic SEO metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article Not Found | NSE Academy" };

  const siteUrl = "https://nseacademy.vitaldigitalmedia.net";
  const canonicalUrl = `${siteUrl}/blog/${article.slug}`;
  const ogImage =
    article.og_image_url ||
    (article.cover_image?.url.startsWith("http")
      ? article.cover_image.url
      : article.cover_image?.url
      ? `${process.env.NEXT_PUBLIC_CMS_URL}${article.cover_image.url}`
      : `${siteUrl}/opengraph-image`);

  const description = article.excerpt ?? article.body.slice(0, 160).replace(/[#*\n]/g, " ").trim();

  return {
    title: `${article.title} | NSE Academy Blog`,
    description,
    authors: [{ name: article.author_name }],
    openGraph: {
      title: article.title,
      description,
      url: canonicalUrl,
      type: "article",
      siteName: "NSE Academy",
      publishedTime: article.publishedAt,
      authors: [article.author_name],
      tags: article.tags ?? [article.category],
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: article.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

// ---------------------------------------------------------------------------
// JSON-LD structured data
// ---------------------------------------------------------------------------

function ArticleJsonLd({ article }: { article: Awaited<ReturnType<typeof getArticleBySlug>> }) {
  if (!article) return null;

  const siteUrl = "https://nseacademy.vitaldigitalmedia.net";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.excerpt ?? article.body.slice(0, 160).replace(/[#*\n]/g, " ").trim(),
    url: `${siteUrl}/blog/${article.slug}`,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: {
      "@type": "Person",
      name: article.author_name,
    },
    publisher: {
      "@type": "Organization",
      name: "NSE Academy",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${siteUrl}/blog/${article.slug}` },
    keywords: article.tags?.join(", ") ?? article.category,
    articleSection: article.category,
    ...(article.cover_image && {
      image: article.cover_image.url.startsWith("http")
        ? article.cover_image.url
        : `${process.env.NEXT_PUBLIC_CMS_URL}${article.cover_image.url}`,
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ---------------------------------------------------------------------------
// Category colour helper
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  "NSE News": "bg-blue-50 text-blue-700",
  "Weekly Roundup": "bg-violet-50 text-violet-700",
  "Daily Update": "bg-amber-50 text-amber-700",
  "Market Analysis": "bg-emerald-50 text-emerald-700",
  "Stock Deep Dive": "bg-teal-50 text-teal-700",
  "IPO Watch": "bg-orange-50 text-orange-700",
  "Investor Education": "bg-indigo-50 text-indigo-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, { articles: related }] = await Promise.all([
    getArticleBySlug(slug),
    getArticles({ limit: 3 }),
  ]);

  if (!article) notFound();

  const relatedArticles = related.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <>
      <ArticleJsonLd article={article} />

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <PublicHeader
          links={[
            { label: "Blog", href: "/blog" },
            { label: "Pricing", href: "/pricing" },
            { label: "Log in", href: "/auth/login" },
          ]}
        />

        <main>
          {/* Cover image */}
          {article.cover_image && (
            <div className="w-full max-h-[480px] overflow-hidden bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  article.cover_image.url.startsWith("http")
                    ? article.cover_image.url
                    : `${process.env.NEXT_PUBLIC_CMS_URL}${article.cover_image.url}`
                }
                alt={article.cover_image.alternativeText ?? article.title}
                className="w-full object-cover"
              />
            </div>
          )}

          {/* Article container */}
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="breadcrumb">
              <Link href="/" className="hover:text-gray-600">Home</Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-gray-600">Blog</Link>
              <span>/</span>
              <span className="text-gray-600 truncate max-w-xs">{article.title}</span>
            </nav>

            {/* Sponsored disclosure banner */}
            {article.is_sponsored && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
                <div className="flex items-center gap-3">
                  {article.sponsor_logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={article.sponsor_logo_url} alt={article.sponsor_name ?? "Sponsor"} className="h-8 w-auto object-contain" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Sponsored Content</p>
                    {article.sponsor_name && (
                      <p className="text-sm text-gray-700">Presented by <span className="font-semibold">{article.sponsor_name}</span></p>
                    )}
                  </div>
                </div>
                {article.sponsor_url && (
                  <a
                    href={article.sponsor_url}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="shrink-0 text-xs font-semibold bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors"
                  >
                    {article.sponsor_cta ?? "Learn more"} →
                  </a>
                )}
              </div>
            )}

            {/* Category */}
            <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 ${CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"}`}>
              {article.category}
            </span>

            {/* Title */}
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-6">
              {article.title}
            </h1>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 pb-8 border-b border-gray-100 mb-8">
              <span className="font-medium text-gray-600">{article.author_name}</span>
              <span>·</span>
              <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
              <span>·</span>
              <span>{article.read_time_minutes} min read</span>
              {article.tags && article.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag) => (
                      <span key={tag} className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Body */}
            <article className="prose prose-gray prose-lg max-w-none prose-headings:font-bold prose-headings:text-gray-900 prose-a:text-emerald-700 prose-a:no-underline hover:prose-a:underline prose-strong:text-gray-900 prose-blockquote:border-emerald-500 prose-blockquote:bg-emerald-50 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1 prose-code:rounded prose-table:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.body}
              </ReactMarkdown>
            </article>

            {/* Sponsor closing CTA */}
            {article.is_sponsored && article.sponsor_url && (
              <div className="mt-12 bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">Sponsored by {article.sponsor_name}</p>
                <h2 className="text-xl font-bold text-gray-900 mb-3">{article.sponsor_cta ?? "Learn more from our sponsor"}</h2>
                <a
                  href={article.sponsor_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-block bg-amber-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-700 transition-colors text-sm"
                >
                  Visit {article.sponsor_name} →
                </a>
              </div>
            )}

            {/* CTA */}
            <div className="mt-12 bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Ready to start investing on the NSE?
              </h2>
              <p className="text-gray-500 mb-6">
                Discover your investor type, get a personalised learning path, and get matched to stocks that fit your goals.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/auth/register" className="inline-block bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors text-sm">
                  Get started free →
                </Link>
                <Link href="/pricing" className="inline-block border border-emerald-200 text-emerald-700 font-medium px-6 py-3 rounded-xl hover:bg-emerald-50 transition-colors text-sm">
                  See pricing
                </Link>
              </div>
            </div>

            {/* Back to blog */}
            <div className="mt-10 pt-8 border-t border-gray-100">
              <Link href="/blog" className="text-sm text-emerald-700 hover:underline">
                ← Back to Blog
              </Link>
            </div>
          </div>

          {/* Related articles */}
          {relatedArticles.length > 0 && (
            <section className="border-t border-gray-100 bg-gray-50 py-12">
              <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <h2 className="text-xl font-bold text-gray-900 mb-8">More from NSE Academy</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {relatedArticles.map((a) => (
                    <Link key={a.id} href={`/blog/${a.slug}`} className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-emerald-200 transition-colors">
                      <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${CATEGORY_COLORS[a.category] ?? "bg-gray-100 text-gray-600"}`}>
                        {a.category}
                      </span>
                      <h3 className="font-bold text-gray-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 mb-2">
                        {a.title}
                      </h3>
                      <p className="text-xs text-gray-400">
                        <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                        {" · "}
                        {a.read_time_minutes} min read
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>

        <PublicFooter />
      </div>
    </>
  );
}

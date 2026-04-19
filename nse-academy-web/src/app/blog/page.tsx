import Link from "next/link";
import type { Metadata } from "next";
import { getArticles, CATEGORIES } from "@/lib/cms";

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "NSE Blog — Market News, Analysis & Weekly Roundups | NSE Academy",
  description:
    "Stay ahead of the Nairobi Securities Exchange with our daily updates, weekly market roundups, stock analysis, and investor education articles. Free for all Kenyan investors.",
  openGraph: {
    title: "NSE Blog — Market News, Analysis & Weekly Roundups",
    description:
      "Daily NSE updates, weekly roundups, stock deep dives, and investor education from NSE Academy.",
    type: "website",
    url: "https://nseacademy.vitaldigitalmedia.net/blog",
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE Blog | NSE Academy",
    description: "Daily NSE updates, weekly roundups, stock analysis for Kenyan investors.",
  },
  alternates: {
    canonical: "https://nseacademy.vitaldigitalmedia.net/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
};

// ---------------------------------------------------------------------------
// Helpers
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
// Page (Server Component — ISR 60s)
// ---------------------------------------------------------------------------

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { category?: string; page?: string };
}) {
  const category = searchParams.category;
  const page = Number(searchParams.page ?? 1);

  const { articles, total, pageCount } = await getArticles({ category, page, limit: 12 });

  const featured = page === 1 && !category ? articles[0] : null;
  const rest = featured ? articles.slice(1) : articles;

  return (
    <div className="min-h-screen bg-white">
      {/* ----------------------------------------------------------------- */}
      {/* Nav */}
      {/* ----------------------------------------------------------------- */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-emerald-700">NSE Academy</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/blog" className="font-semibold text-emerald-700">Blog</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/auth/login" className="hover:text-gray-900">Log in</Link>
          </nav>
          <Link href="/auth/register" className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors">
            Get started
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* ----------------------------------------------------------------- */}
        {/* Page title */}
        {/* ----------------------------------------------------------------- */}
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">NSE Academy Blog</h1>
          <p className="text-gray-500 text-lg max-w-2xl">
            Daily market updates, weekly roundups, stock analysis, and investor education — everything you need to navigate the Nairobi Securities Exchange.
          </p>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Category filter */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-wrap gap-2 mb-10">
          <Link
            href="/blog"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !category ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/blog?category=${encodeURIComponent(cat)}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === cat
                  ? "bg-emerald-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Featured article */}
        {/* ----------------------------------------------------------------- */}
        {featured && (
          <Link href={`/blog/${featured.slug}`} className="block group mb-12">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-900 to-emerald-700 min-h-[340px] flex flex-col justify-end p-8 md:p-12">
              {featured.cover_image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    featured.cover_image.url.startsWith("http")
                      ? featured.cover_image.url
                      : `${process.env.NEXT_PUBLIC_CMS_URL}${featured.cover_image.url}`
                  }
                  alt={featured.cover_image.alternativeText ?? featured.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10">
                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 ${CATEGORY_COLORS[featured.category] ?? "bg-white/10 text-white"}`}>
                  {featured.category}
                </span>
                <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 group-hover:text-emerald-200 transition-colors leading-tight">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="text-emerald-100 text-base md:text-lg max-w-2xl mb-4 line-clamp-2">{featured.excerpt}</p>
                )}
                <div className="flex items-center gap-4 text-emerald-200 text-sm">
                  <span>{featured.author_name}</span>
                  <span>·</span>
                  <time dateTime={featured.publishedAt}>{formatDate(featured.publishedAt)}</time>
                  <span>·</span>
                  <span>{featured.read_time_minutes} min read</span>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Article grid */}
        {/* ----------------------------------------------------------------- */}
        {rest.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {rest.map((article) => (
              <Link key={article.id} href={`/blog/${article.slug}`} className="group flex flex-col">
                {article.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      article.cover_image.url.startsWith("http")
                        ? article.cover_image.url
                        : `${process.env.NEXT_PUBLIC_CMS_URL}${article.cover_image.url}`
                    }
                    alt={article.cover_image.alternativeText ?? article.title}
                    className="w-full h-48 object-cover rounded-2xl mb-4 group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-full h-48 rounded-2xl mb-4 bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center text-4xl">
                    {article.category === "Weekly Roundup" ? "📊" :
                     article.category === "Daily Update" ? "📰" :
                     article.category === "Stock Deep Dive" ? "🔍" :
                     article.category === "Market Analysis" ? "📈" :
                     article.category === "IPO Watch" ? "🚀" :
                     article.category === "Investor Education" ? "🎓" : "📋"}
                  </div>
                )}

                <div className="flex-1 flex flex-col">
                  <span className={`self-start text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"}`}>
                    {article.category}
                  </span>
                  <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-1">{article.excerpt}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-auto pt-3 border-t border-gray-50">
                    <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                    <span>·</span>
                    <span>{article.read_time_minutes} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          !featured && (
            <div className="py-24 text-center text-gray-400">
              <p className="text-5xl mb-4">📭</p>
              <p className="font-medium">No articles yet in this category.</p>
              <Link href="/blog" className="mt-4 inline-block text-emerald-700 hover:underline text-sm">← View all articles</Link>
            </div>
          )
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Pagination */}
        {/* ----------------------------------------------------------------- */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/blog?${category ? `category=${encodeURIComponent(category)}&` : ""}page=${page - 1}`}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors"
              >
                ← Previous
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-gray-500">Page {page} of {pageCount}</span>
            {page < pageCount && (
              <Link
                href={`/blog?${category ? `category=${encodeURIComponent(category)}&` : ""}page=${page + 1}`}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50 transition-colors"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* Footer */}
      {/* ----------------------------------------------------------------- */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-400">
          <span>© 2026 NSE Academy — Empowering Kenyan Investors</span>
          <div className="flex gap-4">
            <Link href="/blog/rss.xml" className="hover:text-gray-600">RSS Feed</Link>
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/auth/register" className="hover:text-gray-600">Sign Up Free</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { getArticles } from "@/lib/cms";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "NSE Academy — Discover Your Investor Type & Learn to Invest in Kenya",
  description:
    "Personalized NSE investor education. Find your investor type, get a custom learning path, and build your Nairobi Stock Exchange portfolio with confidence. Free to start.",
  openGraph: {
    title: "NSE Academy — Discover Your Investor Type",
    description: "Personalized investor education for the Nairobi Securities Exchange.",
    type: "website",
    url: "https://nseacademy.vitaldigitalmedia.net",
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE Academy",
    description: "Personalized NSE investor education for Kenyan investors.",
  },
  alternates: {
    canonical: "https://nseacademy.vitaldigitalmedia.net",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
};

const features = [
  {
    icon: "🎯",
    title: "Investor Profiling",
    description:
      "Take our 10-question quiz and discover whether you're Conservative, Moderate, Aggressive, a Dividend Seeker, or a Growth Investor.",
  },
  {
    icon: "📚",
    title: "Guided Learning Paths",
    description:
      "Courses mapped to your investor type — from NSE basics to fundamental analysis, taxation, and portfolio construction.",
  },
  {
    icon: "📈",
    title: "Stock Recommendations",
    description:
      "Get a personalized watchlist of NSE-listed stocks that match your risk tolerance, time horizon, and goals.",
  },
  {
    icon: "🔬",
    title: "Company Research Tool",
    description:
      "Research any of the 62 NSE-listed companies and see exactly how they fit your investor profile — with a fit score and detailed analysis.",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "KSh 0",
    period: "",
    badge: null,
    features: [
      "Investor profiler quiz",
      "First 3 modules (Getting Started)",
      "NSE glossary access",
      "Basic stock profiles",
    ],
    cta: "Get Started Free",
    href: "/auth/register",
    highlighted: false,
  },
  {
    name: "Intermediary",
    price: "KSh 100",
    period: "/month",
    badge: "Most Popular",
    features: [
      "Everything in Free",
      "NSE Complete Trading Guide course",
      "62 companies deep dive",
      "Stockbroker comparison module",
      "Trading Guide PDF download",
    ],
    cta: "Start Intermediary",
    href: "/auth/register?plan=intermediary",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "KSh 500",
    period: "/month",
    badge: null,
    features: [
      "Everything in Intermediary",
      "Full 13-chapter Investor's Guide",
      "Personalized stock advisor",
      "Company research tool",
      "Investor's Guide PDF download",
      "Priority support",
    ],
    cta: "Start Premium",
    href: "/auth/register?plan=premium",
    highlighted: true,
  },
];

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
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default async function LandingPage() {
  const { articles: latestArticles } = await getArticles({ limit: 3 });

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-emerald-700">NSE Academy</Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link href="/blog" className="hover:text-gray-900">Blog</Link>
            <Link href="/calculators" className="hover:text-gray-900">Calculators</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/auth/login" className="hover:text-gray-900">Log in</Link>
          </nav>
          <Link href="/auth/register" className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors">
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Built for Kenyan investors
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Discover your investor type.
          <br />
          <span className="text-emerald-700">Build your NSE portfolio with confidence.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-gray-500 mb-10">
          NSE Academy profiles your risk tolerance, time horizon, and goals — then gives you a personalised learning path and stock recommendations tailored to the Nairobi Securities Exchange.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-sm"
          >
            Discover my investor type →
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center gap-2 border border-gray-200 text-gray-700 text-base font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Read the blog
          </Link>
        </div>
        <p className="mt-4 text-sm text-gray-400">Free to start — no credit card required</p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything you need to invest in the NSE
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest from the blog */}
      {latestArticles.length > 0 && (
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Latest from the Blog</h2>
                <p className="text-gray-500 mt-1">NSE news, analysis, and weekly roundups</p>
              </div>
              <Link href="/blog" className="text-sm font-medium text-emerald-700 hover:underline hidden sm:block">
                View all articles →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestArticles.map((article) => (
                <Link key={article.id} href={`/blog/${article.slug}`} className="group flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-emerald-200 hover:shadow-sm transition-all">
                  {article.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        article.cover_image.url.startsWith("http")
                          ? article.cover_image.url
                          : `${process.env.NEXT_PUBLIC_CMS_URL}${article.cover_image.url}`
                      }
                      alt={article.cover_image.alternativeText ?? article.title}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center text-4xl">
                      {article.category === "Weekly Roundup" ? "📊" :
                       article.category === "Market Analysis" ? "📈" :
                       article.category === "Daily Update" ? "📰" : "📋"}
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <span className={`self-start text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"}`}>
                      {article.category}
                    </span>
                    <h3 className="font-bold text-gray-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 mb-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-auto">
                      <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                      {" · "}
                      {article.read_time_minutes} min read
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8 sm:hidden">
              <Link href="/blog" className="text-sm font-medium text-emerald-700 hover:underline">View all articles →</Link>
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-center text-gray-500 mb-12">Start free. Upgrade when you're ready to go deeper.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 border ${
                  tier.highlighted
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-lg"
                    : "border-gray-200 bg-white"
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                    {tier.badge}
                  </span>
                )}
                <h3 className={`font-bold text-xl mb-1 ${tier.highlighted ? "text-white" : "text-gray-900"}`}>
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-bold ${tier.highlighted ? "text-white" : "text-gray-900"}`}>
                    {tier.price}
                  </span>
                  <span className={tier.highlighted ? "text-emerald-200" : "text-gray-400"}>{tier.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <span className={tier.highlighted ? "text-emerald-300" : "text-emerald-600"}>✓</span>
                      <span className={tier.highlighted ? "text-emerald-50" : "text-gray-600"}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`block text-center font-semibold py-3 px-6 rounded-xl transition-colors ${
                    tier.highlighted
                      ? "bg-white text-emerald-700 hover:bg-emerald-50"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <span>© 2026 NSE Academy — Infinity Digital Works</span>
          <div className="flex gap-6">
            <Link href="/blog" className="hover:text-gray-600">Blog</Link>
            <Link href="/calculators" className="hover:text-gray-600">Calculators</Link>
            <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            <Link href="/glossary" className="hover:text-gray-600">Glossary</Link>
            <Link href="/faq" className="hover:text-gray-600">FAQ</Link>
            <Link href="/blog/rss.xml" className="hover:text-gray-600">RSS</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

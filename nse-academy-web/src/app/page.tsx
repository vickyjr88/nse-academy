import Link from "next/link";
import type { Metadata } from "next";
import { getArticles } from "@/lib/cms";
import { getDigitalProducts } from "@/lib/dexter";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

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
  const ebooks = await getDigitalProducts();

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

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

      {/* Ebooks */}
      {ebooks.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">NSE Investment Guides</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Comprehensive ebooks to accelerate your investing journey on the Nairobi Securities Exchange.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {ebooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
                >
                  {book.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.thumbnail}
                      alt={book.name}
                      className="w-full h-52 object-cover"
                    />
                  )}
                  <div className="p-6 flex flex-col flex-1">
                    <span className="self-start text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full mb-3">
                      {book.category}
                    </span>
                    <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2">{book.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">{book.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-gray-900">
                          KSh {book.price.toLocaleString("en-KE")}
                        </span>
                        {book.compare_at_price && (
                          <span className="text-sm text-gray-400 line-through">
                            KSh {book.compare_at_price.toLocaleString("en-KE")}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/ebooks/buy/${book.id}`}
                        className="bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors"
                      >
                        Buy Now →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
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

      {/* Broker Referral */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center gap-8 shadow-xl">
            <div className="flex-1 text-white">
              <div className="inline-flex items-center gap-2 bg-emerald-600/50 text-emerald-100 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                🏦 Partner Broker
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Ready to start investing?<br />Open your NSE account today.
              </h2>
              <p className="text-emerald-100 mb-6 max-w-lg">
                Partner with <strong>AIB AXYS Africa</strong> — a CMA-regulated stockbroker trusted since 1995.
                Open a CDS account 100% online in under 10 minutes and start buying NSE shares.
              </p>
              <ul className="space-y-2 mb-8">
                {["CMA regulated & trusted since 1995", "100% online account opening — no paperwork", "Trade equities, bonds & ETFs from your phone", "Competitive brokerage rates"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-emerald-100">
                    <span className="text-emerald-300 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://aibaxys.kenyaonlinetrading.com/ActiveTrader/#!/new-trading-account?ReferralCode=REF39870"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-white text-emerald-800 font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-md"
                >
                  Open Account with AIB AXYS →
                </a>
                <div className="flex items-center gap-2 text-emerald-200 text-sm bg-emerald-800/40 px-4 py-3.5 rounded-xl">
                  <span className="text-emerald-300 text-xs font-medium">Referral code:</span>
                  <span className="font-mono font-bold tracking-widest">REF39870</span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center justify-center bg-white/10 rounded-2xl p-8 min-w-[200px] text-center">
              <div className="text-6xl mb-3">📈</div>
              <p className="text-white font-bold text-lg">Start investing</p>
              <p className="text-emerald-200 text-sm mt-1">with as little as</p>
              <p className="text-white font-extrabold text-3xl mt-1">KSh 500</p>
              <p className="text-emerald-300 text-xs mt-2">minimum investment</p>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

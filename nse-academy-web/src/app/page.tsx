import Link from "next/link";
import type { Metadata } from "next";
import { getArticles } from "@/lib/cms";
import { getDigitalProducts } from "@/lib/dexter";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { TrackedAnchor, TrackedLink } from "@/components/TrackedLink";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "NSE Academy — Discover Your Investor Type & Learn to Invest in Kenya",
  description:
    "Personalized NSE investor education. Find your investor type, get a custom learning path, and build your Nairobi Stock Exchange portfolio with confidence. Free to start.",
  openGraph: {
    title: "NSE Academy — Discover Your Investor Type",
    description: "Personalized investor education for the Nairobi Securities Exchange.",
    type: "website",
    url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net'),
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE Academy",
    description: "Personalized NSE investor education for Kenyan investors.",
  },
  alternates: {
    canonical: (process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net'),
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "NSE Academy",
    "url": (process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net'),
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net'}/companies/{search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
          <TrackedLink
            href="/investor-profiler"
            event="profiler_cta_clicked"
            eventProps={{ location: "hero" }}
            className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-sm"
          >
            Discover my investor type →
          </TrackedLink>
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
                      <TrackedLink
                        href={`/ebooks/buy/${book.id}`}
                        event="ebook_card_clicked"
                        eventProps={{
                          location: "homepage",
                          productId: book.id,
                          name: book.name,
                          priceKes: book.price,
                        }}
                        className="bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors"
                      >
                        Buy Now →
                      </TrackedLink>
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
                <TrackedLink
                  href={tier.href}
                  event="pricing_tier_clicked"
                  eventProps={{
                    tier_name: tier.name,
                    tier_price: tier.price,
                    location: "landing_pricing",
                  }}
                  className={`block text-center font-semibold py-3 px-6 rounded-xl transition-colors ${
                    tier.highlighted
                      ? "bg-white text-emerald-700 hover:bg-emerald-50"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {tier.cta}
                </TrackedLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp Channel */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center gap-8 shadow-xl">
            <div className="flex-1 text-white">
              <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
                Free · No spam · Daily at 8pm
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Get the NSE daily wrap on WhatsApp
              </h2>
              <p className="text-white/90 mb-6 max-w-lg">
                Market close summary, top gainers and losers, turnover, and a one-line take — delivered every NSE trading day at 8pm. Free channel. No DMs, just the wrap.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  "Daily post-market wrap at 8pm EAT",
                  "NSE 20, NASI, turnover & breadth at a glance",
                  "Named gainers, losers, most active counters",
                  "One-tap join — your number stays private",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/95">
                    <span className="text-white shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <TrackedAnchor
                href="https://whatsapp.com/channel/0029Vb7NzBL7YSdAiq5Tiv07"
                target="_blank"
                rel="noopener noreferrer"
                event="whatsapp_channel_clicked"
                eventProps={{ location: "landing" }}
                className="inline-flex items-center justify-center gap-2 bg-white text-[#128C7E] font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-md"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Join the WhatsApp Channel
              </TrackedAnchor>
            </div>
            <div className="hidden md:flex flex-col items-center justify-center bg-white/10 rounded-2xl p-8 min-w-[200px] text-center">
              <svg viewBox="0 0 24 24" className="w-16 h-16 text-white mb-3" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <p className="text-white font-bold text-lg">NSE Daily Brief</p>
              <p className="text-white/80 text-sm mt-1">by NSE Academy</p>
              <p className="text-white/80 text-xs mt-2">Channel</p>
            </div>
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
                <TrackedAnchor
                  href="https://aibaxys.kenyaonlinetrading.com/ActiveTrader/#!/new-trading-account?ReferralCode=REF39870"
                  target="_blank"
                  rel="noopener noreferrer"
                  event="broker_referral_clicked"
                  eventProps={{ partner: "aib_axys", referral_code: "REF39870" }}
                  className="inline-flex items-center justify-center gap-2 bg-white text-emerald-800 font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-md"
                >
                  Open Account with AIB AXYS →
                </TrackedAnchor>
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

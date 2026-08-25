import Link from "next/link";
import type { Metadata } from "next";
import { getArticles, getLeadMagnet } from "@/lib/cms";
import { getDigitalProducts, type DexterProduct } from "@/lib/dexter";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { TrackedAnchor, TrackedLink } from "@/components/TrackedLink";
import LeadMagnetForm from "@/components/LeadMagnetForm";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "NSE Academy - The Complete Investor's Guide to the Nairobi Securities Exchange",
  description:
    "Build a real NSE portfolio with the Complete Investor's Guide (KSh 999) or subscribe from KSh 300/mo. Stock picks, deep-dive research, dividend laddering, and a personalised learning path for Kenyan investors.",
  openGraph: {
    title: "NSE Academy - Build Your NSE Portfolio With Confidence",
    description:
      "The Complete Investor's Guide ebook, personalised stock picks, and weekly NSE research - for Kenyan investors.",
    type: "website",
    url:
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://nseacademy.vitaldigitalmedia.net",
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE Academy",
    description:
      "Ebook, subscription, and weekly NSE research for Kenyan investors.",
  },
  alternates: {
    canonical:
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://nseacademy.vitaldigitalmedia.net",
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
      "Courses mapped to your investor type - from NSE basics to fundamental analysis, taxation, and portfolio construction.",
  },
  {
    icon: "📈",
    title: "Stock Recommendations",
    description:
      "A personalised watchlist of NSE-listed stocks matched to your risk tolerance, time horizon, and goals.",
  },
  {
    icon: "🔬",
    title: "Company Research Tool",
    description:
      "Research any of the 62 NSE-listed companies and see exactly how they fit your profile - with a fit score and detailed analysis.",
  },
];

const pricingTiers = [
  {
    name: "Intermediary",
    price: "KSh 300",
    period: "/month",
    badge: "Start here",
    features: [
      "NSE Complete Trading Guide course",
      "62 companies deep dive",
      "Stockbroker comparison module",
      "Trading Guide PDF",
      "Cancel anytime",
    ],
    cta: "Start Intermediary - KSh 300/mo",
    href: "/auth/register?plan=intermediary",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "KSh 500",
    period: "/month",
    badge: "Best Value",
    features: [
      "Everything in Intermediary",
      "Full 13-chapter Investor's Guide",
      "Personalised stock advisor",
      "Company research & fit scores",
      "Complete Investor's Guide PDF (worth KSh 999) - included",
      "Priority support",
    ],
    cta: "Start Premium - KSh 500/mo",
    href: "/auth/register?plan=premium",
    highlighted: true,
  },
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
    cta: "Take the free quiz first",
    href: "/investor-profiler",
    highlighted: false,
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
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const LEAD_CAPTURE_ENABLED =
  process.env.NEXT_PUBLIC_LEAD_CAPTURE_ENABLED === "true";

function pickHeadlineEbook(ebooks: DexterProduct[]): DexterProduct | null {
  if (ebooks.length === 0) return null;
  const guide = ebooks.find((b) => /complete\s+investor/i.test(b.name));
  return guide ?? ebooks[0];
}

export default async function LandingPage() {
  const [{ articles: latestArticles }, ebooks, leadMagnet] = await Promise.all([
    getArticles({ limit: 3 }),
    getDigitalProducts(),
    LEAD_CAPTURE_ENABLED ? getLeadMagnet("free-chapter") : Promise.resolve(null),
  ]);

  const headlineEbook = pickHeadlineEbook(ebooks);
  const otherEbooks = headlineEbook
    ? ebooks.filter((b) => b.id !== headlineEbook.id)
    : ebooks;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "NSE Academy",
    "url":
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://nseacademy.vitaldigitalmedia.net",
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${process.env.NEXT_PUBLIC_SITE_URL || "https://nseacademy.vitaldigitalmedia.net"}/companies/{search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicHeader />

      {/* Hero - paid offer is primary, free quiz is secondary */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Trusted by Kenyan investors building real NSE portfolios
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-5">
              Build a real NSE portfolio
              <br />
              <span className="text-emerald-700">in 30 days - not 3 years.</span>
            </h1>
            <p className="max-w-2xl text-lg text-gray-600 mb-8">
              The Complete Investor&apos;s Guide gives you a tested framework for picking NSE
              stocks, building a dividend ladder, and avoiding the rookie mistakes that cost
              Kenyan retail investors a fortune every year.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {headlineEbook ? (
                <TrackedLink
                  href={`/ebooks/buy/${headlineEbook.id}`}
                  event="hero_primary_cta_clicked"
                  eventProps={{
                    intent: "ebook",
                    productId: headlineEbook.id,
                    priceKes: headlineEbook.price,
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white text-base font-bold px-7 py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-100"
                >
                  Get the Complete Guide - KSh {headlineEbook.price.toLocaleString("en-KE")} →
                </TrackedLink>
              ) : (
                <TrackedLink
                  href="/auth/register?plan=premium"
                  event="hero_primary_cta_clicked"
                  eventProps={{ intent: "premium" }}
                  className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white text-base font-bold px-7 py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-100"
                >
                  Start Premium - KSh 500/mo →
                </TrackedLink>
              )}
              <TrackedLink
                href="/auth/register?plan=intermediary"
                event="hero_secondary_cta_clicked"
                eventProps={{ intent: "intermediary" }}
                className="inline-flex items-center justify-center gap-2 bg-white border border-emerald-300 text-emerald-800 text-base font-semibold px-7 py-4 rounded-xl hover:bg-emerald-50 transition-colors"
              >
                Or subscribe from KSh 300/mo
              </TrackedLink>
            </div>

            <p className="text-sm text-gray-500">
              Or{" "}
              <TrackedLink
                href="/investor-profiler"
                event="hero_tertiary_cta_clicked"
                eventProps={{ intent: "profiler" }}
                className="text-emerald-700 font-medium hover:underline underline-offset-2"
              >
                take the free 3-minute quiz
              </TrackedLink>{" "}
              to find your investor type first.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span aria-hidden>🔒</span>
                <span>M-Pesa &amp; card via Paystack</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden>♾️</span>
                <span>Ebook = lifetime access</span>
              </div>
              <div className="flex items-center gap-2">
                <span aria-hidden>↩️</span>
                <span>Subscription = cancel anytime</span>
              </div>
            </div>
          </div>

          {headlineEbook && (
            <div className="lg:col-span-5">
              <div className="relative bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-3xl p-6 border border-emerald-100 shadow-xl">
                <span className="absolute -top-3 left-6 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
                {headlineEbook.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={headlineEbook.thumbnail}
                    alt={headlineEbook.name}
                    className="w-full h-56 object-cover rounded-2xl mb-5 border border-gray-100"
                  />
                )}
                <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2">
                  {headlineEbook.name}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                  {headlineEbook.description}
                </p>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-black text-gray-900">
                    KSh {headlineEbook.price.toLocaleString("en-KE")}
                  </span>
                  {headlineEbook.compare_at_price && (
                    <span className="text-sm text-gray-400 line-through">
                      KSh {headlineEbook.compare_at_price.toLocaleString("en-KE")}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">one-time</span>
                </div>
                <TrackedLink
                  href={`/ebooks/buy/${headlineEbook.id}`}
                  event="hero_ebook_card_clicked"
                  eventProps={{
                    productId: headlineEbook.id,
                    priceKes: headlineEbook.price,
                  }}
                  className="block text-center bg-emerald-700 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-800 transition-colors shadow-md"
                >
                  Buy &amp; download now →
                </TrackedLink>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-gray-100 bg-gray-50 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { stat: "62", label: "NSE-listed companies covered" },
            { stat: "13", label: "Chapters in the Complete Guide" },
            { stat: "M-Pesa", label: "Pay how Kenyans pay" },
            { stat: "Daily", label: "NSE market wraps on WhatsApp" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700">{s.stat}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ebooks - moved up, second priority after hero */}
      {ebooks.length > 0 && (
        <section id="ebooks" className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="mb-10 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
                Own the playbook
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                NSE Investment Guides
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Comprehensive ebooks to accelerate your investing journey on the
                Nairobi Securities Exchange. Buy once, download, read forever.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[headlineEbook, ...otherEbooks].filter((b): b is DexterProduct => !!b).map((book) => (
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
                    <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2">
                      {book.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">
                      {book.description}
                    </p>
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
            <p className="text-center text-xs text-gray-500 mt-6">
              💡 Premium subscribers get the Complete Investor&apos;s Guide ebook (worth
              KSh 999) <strong>included</strong> with their subscription.
            </p>
          </div>
        </section>
      )}

      {/* Pricing - paid tiers first, free demoted */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
            Or subscribe
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-900 mb-3">
            Subscribe and keep getting better
          </h2>
          <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
            New NSE research every week. Cancel anytime - no Kenyan bank shenanigans.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 border ${
                  tier.highlighted
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-2xl scale-105"
                    : "border-gray-200 bg-white"
                }`}
              >
                {tier.badge && (
                  <span
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full ${
                      tier.highlighted
                        ? "bg-amber-400 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {tier.badge}
                  </span>
                )}
                <h3
                  className={`font-bold text-xl mb-1 ${
                    tier.highlighted ? "text-white" : "text-gray-900"
                  }`}
                >
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span
                    className={`text-4xl font-bold ${
                      tier.highlighted ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {tier.price}
                  </span>
                  <span
                    className={tier.highlighted ? "text-emerald-200" : "text-gray-400"}
                  >
                    {tier.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <span
                        className={tier.highlighted ? "text-emerald-300" : "text-emerald-600"}
                      >
                        ✓
                      </span>
                      <span
                        className={tier.highlighted ? "text-emerald-50" : "text-gray-600"}
                      >
                        {feat}
                      </span>
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
                      : tier.name === "Free"
                      ? "border border-gray-200 text-gray-700 hover:bg-gray-50"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {tier.cta}
                </TrackedLink>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-500 mt-8">
            Running a team or SACCO?{" "}
            <Link href="/pricing" className="text-emerald-700 font-medium hover:underline">
              See corporate tiers →
            </Link>
          </p>
        </div>
      </section>

      {/* Lead magnet - kept but moved below the paid offers */}
      {leadMagnet && (
        <section className="bg-emerald-50/40 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <LeadMagnetForm magnet={leadMagnet} source="landing_below_pricing" />
          </div>
        </section>
      )}

      {/* Features */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Everything you need to invest in the NSE
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
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
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Latest from the Blog</h2>
                <p className="text-gray-500 mt-1">
                  NSE news, analysis, and weekly roundups
                </p>
              </div>
              <Link
                href="/blog"
                className="text-sm font-medium text-emerald-700 hover:underline hidden sm:block"
              >
                View all articles →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {latestArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/blog/${article.slug}`}
                  className="group flex flex-col bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-emerald-200 hover:shadow-sm transition-all"
                >
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
                      {article.category === "Weekly Roundup"
                        ? "📊"
                        : article.category === "Market Analysis"
                        ? "📈"
                        : article.category === "Daily Update"
                        ? "📰"
                        : "📋"}
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <span
                      className={`self-start text-xs font-bold px-2.5 py-1 rounded-full mb-2 ${
                        CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {article.category}
                    </span>
                    <h3 className="font-bold text-gray-900 leading-snug group-hover:text-emerald-700 transition-colors line-clamp-2 mb-2">
                      {article.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-auto">
                      <time dateTime={article.publishedAt}>
                        {formatDate(article.publishedAt)}
                      </time>
                      {" · "}
                      {article.read_time_minutes} min read
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8 sm:hidden">
              <Link href="/blog" className="text-sm font-medium text-emerald-700 hover:underline">
                View all articles →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Broker partner */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-8 sm:p-12 flex flex-col md:flex-row items-center gap-8 shadow-xl">
            <div className="flex-1 text-white">
              <div className="inline-flex items-center gap-2 bg-emerald-600/50 text-emerald-100 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                🏦 Partner Broker
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                Ready to start investing?
                <br />
                Open your NSE account today.
              </h2>
              <p className="text-emerald-100 mb-6 max-w-lg">
                Partner with <strong>AIB AXYS Africa</strong> - a CMA-regulated stockbroker
                trusted since 1995. Open a CDS account 100% online in under 10 minutes and
                start buying NSE shares.
              </p>
              <ul className="space-y-2 mb-8">
                {[
                  "CMA regulated & trusted since 1995",
                  "100% online account opening - no paperwork",
                  "Trade equities, bonds & ETFs from your phone",
                  "Competitive brokerage rates",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-emerald-100"
                  >
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
                  <span className="text-emerald-300 text-xs font-medium">
                    Referral code:
                  </span>
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

      {/* Final CTA + WhatsApp moved to a quieter slot at the bottom */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {headlineEbook && (
            <div className="bg-white border border-emerald-100 rounded-3xl p-7 shadow-sm flex flex-col">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
                Ready to skip the trial &amp; error?
              </p>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Get the Complete Investor&apos;s Guide
              </h3>
              <p className="text-gray-500 mb-5 flex-1">
                One purchase. 13 chapters. The framework Kenyan investors use to build
                NSE portfolios that actually compound.
              </p>
              <TrackedLink
                href={`/ebooks/buy/${headlineEbook.id}`}
                event="footer_ebook_cta_clicked"
                eventProps={{ productId: headlineEbook.id }}
                className="inline-block text-center bg-emerald-700 text-white font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-800 transition-colors"
              >
                Buy now - KSh {headlineEbook.price.toLocaleString("en-KE")} →
              </TrackedLink>
            </div>
          )}
          <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-3xl p-7 text-white shadow-sm flex flex-col">
            <p className="text-xs font-bold uppercase tracking-widest text-white/80 mb-2">
              Stay close to the market - free
            </p>
            <h3 className="text-2xl font-bold mb-2">NSE Daily Brief on WhatsApp</h3>
            <p className="text-white/90 text-sm mb-5 flex-1">
              Post-market wrap at 8pm EAT - indices, named gainers/losers, turnover. Free
              channel. No DMs.
            </p>
            <TrackedAnchor
              href="https://whatsapp.com/channel/0029Vb7NzBL7YSdAiq5Tiv07"
              target="_blank"
              rel="noopener noreferrer"
              event="whatsapp_channel_clicked"
              eventProps={{ location: "landing_footer" }}
              className="inline-block text-center bg-white text-[#128C7E] font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors"
            >
              Join the channel →
            </TrackedAnchor>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

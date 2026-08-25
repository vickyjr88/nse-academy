import Link from "next/link";
import type { Metadata } from "next";
import { getLeadMagnet } from "@/lib/cms";
import { getDigitalProducts, type DexterProduct } from "@/lib/dexter";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { TrackedAnchor, TrackedLink } from "@/components/TrackedLink";
import LeadMagnetForm from "@/components/LeadMagnetForm";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "NSE Academy - The Complete Investor's Guide to the Nairobi Securities Exchange",
  description:
    "Personalised NSE stock picks, deep-dive research, and a portfolio you can actually track - from KSh 300/mo. Built for Kenyan investors.",
  openGraph: {
    title: "NSE Academy - Build Your NSE Portfolio With Confidence",
    description:
      "Personalised stock picks, deep-dive research, and portfolio tracking for Kenyan investors.",
    type: "website",
    url:
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://nseacademy.vitaldigitalmedia.net",
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE Academy",
    description: "Personalised NSE research and portfolio tracking for Kenyan investors.",
  },
  alternates: {
    canonical:
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://nseacademy.vitaldigitalmedia.net",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
};

const pricingTiers = [
  {
    name: "Intermediary",
    price: "KSh 300",
    period: "/month",
    badge: null,
    features: [
      "NSE Complete Trading Guide course",
      "62 companies deep dive",
      "Trade journal & broker fee tracking",
      "Stockbroker comparison module",
    ],
    cta: "Start Intermediary",
    href: "/auth/register?plan=intermediary",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "KSh 500",
    period: "/month",
    badge: "Most Popular",
    features: [
      "Everything in Intermediary",
      "Personalised stock advisor",
      "Company research & fit scores",
      "Price alerts & dividend tracking",
      "Complete Investor's Guide ebook included (worth KSh 999)",
      "Priority support",
    ],
    cta: "Start Premium",
    href: "/auth/register?plan=premium",
    highlighted: true,
  },
];

const proofPoints = [
  {
    icon: "🎯",
    title: "Matched to you",
    description: "A 10-question quiz maps your risk profile to a personalised stock watchlist and learning path.",
  },
  {
    icon: "📈",
    title: "Track what you own",
    description: "Log trades across every broker, see live portfolio value, and get alerted when a price target hits.",
  },
  {
    icon: "🔬",
    title: "Research that fits",
    description: "Fit scores for all 62 NSE-listed companies against your specific investor profile.",
  },
];

const LEAD_CAPTURE_ENABLED =
  process.env.NEXT_PUBLIC_LEAD_CAPTURE_ENABLED === "true";

function pickHeadlineEbook(ebooks: DexterProduct[]): DexterProduct | null {
  if (ebooks.length === 0) return null;
  const guide = ebooks.find((b) => /complete\s+investor/i.test(b.name));
  return guide ?? ebooks[0];
}

export default async function LandingPage() {
  const [ebooks, leadMagnet] = await Promise.all([
    getDigitalProducts(),
    LEAD_CAPTURE_ENABLED ? getLeadMagnet("free-chapter") : Promise.resolve(null),
  ]);

  const headlineEbook = pickHeadlineEbook(ebooks);

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

      {/* Hero - subscription is the one ask */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Trusted by Kenyan investors building real NSE portfolios
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-5">
          Build a real NSE portfolio
          <br />
          <span className="text-emerald-700">in 30 days - not 3 years.</span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-gray-600 mb-8">
          Personalised stock picks, deep-dive research, and a portfolio you can actually
          track across every broker - the framework Kenyan investors use to stop guessing.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
          <TrackedLink
            href="/auth/register?plan=premium"
            event="hero_primary_cta_clicked"
            eventProps={{ intent: "premium" }}
            className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white text-base font-bold px-8 py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-100"
          >
            Start Premium - KSh 500/mo →
          </TrackedLink>
          <TrackedLink
            href="#pricing"
            event="hero_secondary_cta_clicked"
            eventProps={{ intent: "compare_plans" }}
            className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 text-base font-semibold px-8 py-4 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Compare plans
          </TrackedLink>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span aria-hidden>🔒</span>
            <span>M-Pesa &amp; card via Paystack</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>↩️</span>
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden>⚡</span>
            <span>Live in minutes</span>
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section className="border-y border-gray-100 bg-gray-50 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { stat: "62", label: "NSE-listed companies covered" },
            { stat: "13", label: "Chapters in the Complete Guide" },
            { stat: "M-Pesa", label: "Pay how Kenyans pay" },
            { stat: "Live", label: "Portfolio & price tracking" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl sm:text-2xl font-bold text-emerald-700">{s.stat}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing - the one decision to make */}
      <section id="pricing" className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
              Simple pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Pick a plan and start today
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              New NSE research every week. Cancel anytime - no Kenyan bank shenanigans.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 border ${
                  tier.highlighted
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-2xl md:scale-105"
                    : "border-gray-200 bg-white"
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-3 py-1 rounded-full bg-amber-400 text-amber-900">
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
                  <span className={tier.highlighted ? "text-emerald-200" : "text-gray-400"}>
                    {tier.period}
                  </span>
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
                  eventProps={{ tier_name: tier.name, tier_price: tier.price, location: "landing_pricing" }}
                  className={`block text-center font-semibold py-3.5 px-6 rounded-xl transition-colors ${
                    tier.highlighted
                      ? "bg-white text-emerald-700 hover:bg-emerald-50"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {tier.cta} →
                </TrackedLink>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-500 mt-8">
            Not ready to pay?{" "}
            <TrackedLink
              href="/investor-profiler"
              event="hero_tertiary_cta_clicked"
              eventProps={{ intent: "profiler" }}
              className="text-emerald-700 font-medium hover:underline underline-offset-2"
            >
              Try the free 3-minute quiz
            </TrackedLink>{" "}
            first, or{" "}
            <Link href="/pricing" className="text-emerald-700 font-medium hover:underline">
              see corporate/SACCO tiers
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Lead magnet - only shown if enabled, sits below the main decision */}
      {leadMagnet && (
        <section className="bg-emerald-50/40 py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <LeadMagnetForm magnet={leadMagnet} source="landing_below_pricing" />
          </div>
        </section>
      )}

      {/* Condensed proof: what subscribers get + the ebook alternative */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-10">
            What you actually get
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
            {proofPoints.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>

          {headlineEbook && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Prefer a one-time purchase?
                </p>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{headlineEbook.name}</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Buy once, download, read forever. Premium subscribers get this included.
                </p>
                <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                  <span className="text-2xl font-bold text-gray-900">
                    KSh {headlineEbook.price.toLocaleString("en-KE")}
                  </span>
                  {headlineEbook.compare_at_price && (
                    <span className="text-sm text-gray-400 line-through">
                      KSh {headlineEbook.compare_at_price.toLocaleString("en-KE")}
                    </span>
                  )}
                </div>
              </div>
              <TrackedLink
                href={`/ebooks/buy/${headlineEbook.id}`}
                event="ebook_card_clicked"
                eventProps={{ location: "homepage_proof", productId: headlineEbook.id, priceKes: headlineEbook.price }}
                className="shrink-0 bg-gray-900 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition-colors text-sm"
              >
                Buy the ebook →
              </TrackedLink>
            </div>
          )}
        </div>
      </section>

      {/* Broker partner - kept as a compact single mention */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="text-white text-center md:text-left">
              <p className="text-xs font-semibold text-emerald-200 mb-2">Need a broker?</p>
              <h3 className="text-xl font-bold mb-1">Open a CDS account with AIB AXYS</h3>
              <p className="text-emerald-100 text-sm">
                CMA-regulated, 100% online, under 10 minutes.
              </p>
            </div>
            <TrackedAnchor
              href="https://aibaxys.kenyaonlinetrading.com/ActiveTrader/#!/new-trading-account?ReferralCode=REF39870"
              target="_blank"
              rel="noopener noreferrer"
              event="broker_referral_clicked"
              eventProps={{ partner: "aib_axys", referral_code: "REF39870" }}
              className="shrink-0 inline-flex items-center justify-center gap-2 bg-white text-emerald-800 font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-md"
            >
              Open Account →
            </TrackedAnchor>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Also on WhatsApp:{" "}
            <TrackedAnchor
              href="https://whatsapp.com/channel/0029Vb7NzBL7YSdAiq5Tiv07"
              target="_blank"
              rel="noopener noreferrer"
              event="whatsapp_channel_clicked"
              eventProps={{ location: "landing_footer" }}
              className="text-emerald-700 font-medium hover:underline"
            >
              free daily NSE market wrap
            </TrackedAnchor>
            {" · "}
            <Link href="/blog" className="text-emerald-700 font-medium hover:underline">
              read the latest research
            </Link>
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import CalculatorsClient from "./CalculatorsClient";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "NSE Calculators — Broker Fees, Dividend Yield, Compound Growth | NSE Academy",
  description:
    "Free NSE investment calculators for Kenyan investors. Calculate broker fees, dividend yield, compound growth, DCA returns, and how many shares you need for your income target.",
  keywords: [
    "NSE broker fee calculator Kenya",
    "NSE dividend yield calculator",
    "Kenya stock market compound growth calculator",
    "DCA calculator NSE",
    "Nairobi Securities Exchange calculator",
    "NSE transaction cost calculator",
    "dividend income calculator Kenya",
  ],
  openGraph: {
    title: "NSE Calculators — Free Tools for Kenyan Investors",
    description:
      "Calculate broker fees, dividend yield, compound growth, DCA returns and dividend income targets for NSE investments.",
    type: "website",
    url: "https://nseacademy.vitaldigitalmedia.net/calculators",
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE Investment Calculators | NSE Academy",
    description: "Free calculators for Kenyan NSE investors — fees, dividends, compounding, DCA.",
  },
  alternates: { canonical: "https://nseacademy.vitaldigitalmedia.net/calculators" },
};

// ---------------------------------------------------------------------------
// JSON-LD — FAQ targeting high-value search queries
// ---------------------------------------------------------------------------

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What are the transaction costs when buying shares on the NSE?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When buying NSE shares you pay: brokerage commission (~1.8%), CDS fee (0.12%), NSE levy (0.12%), and CMA levy (0.06%). Total is approximately 2.1% of the trade value. Use our Broker Fee Calculator to get the exact breakdown for any trade size.",
      },
    },
    {
      "@type": "Question",
      name: "How do I calculate dividend yield on the NSE?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Dividend Yield = (Annual Dividend per Share ÷ Current Share Price) × 100. For example, if a stock pays KSh 2 per share and trades at KSh 40, the yield is 5%. Use our Dividend Yield Calculator for instant results.",
      },
    },
    {
      "@type": "Question",
      name: "How much will my NSE investment grow over time?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use our Compound Growth Calculator. Enter your initial investment, monthly contributions, expected annual return, and time horizon. The NSE gained 52% in 2025; historical long-term average is approximately 12–15% per year.",
      },
    },
    {
      "@type": "Question",
      name: "How many NSE shares do I need to earn a target monthly income from dividends?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Use our Dividend Income Target calculator. Enter your target monthly income, the stock's dividend per share, and dividend frequency. We'll calculate exactly how many shares — and how much capital — you need.",
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Page (Server Component wrapping Client calculators)
// ---------------------------------------------------------------------------

export default function CalculatorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Nav */}
        <PublicHeader />

        {/* Hero */}
        <div className="bg-white border-b border-gray-100 py-12 px-4 sm:px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">NSE Investment Calculators</h1>
            <p className="text-gray-500 text-lg">
              Free tools to estimate broker fees, dividend yields, compound growth, and income targets — built for Kenyan NSE investors.
            </p>
          </div>
        </div>

        {/* Calculators (client) */}
        <CalculatorsClient />

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
          <div className="bg-emerald-700 rounded-3xl p-10 text-center text-white">
            <h2 className="text-2xl font-bold mb-2">Ready to start investing?</h2>
            <p className="text-emerald-100 mb-6">
              Discover your investor type, get a personalised stock watchlist, and access the full NSE Academy course library.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/register" className="bg-white text-emerald-700 font-bold px-6 py-3 rounded-xl hover:bg-emerald-50 transition-colors text-sm">
                Get started free →
              </Link>
              <Link href="/pricing" className="border border-emerald-500 text-white font-medium px-6 py-3 rounded-xl hover:bg-emerald-600 transition-colors text-sm">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <PublicFooter />
      </div>
    </>
  );
}

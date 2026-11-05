import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME, WHATSAPP_CHANNEL, abs, breadcrumbJsonLd, organizationJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "About NSE Academy - Independent Investor Education for Kenya",
  description:
    "NSE Academy is an independent investor-education platform for the Nairobi Securities Exchange, built by Infinity Digital Works. Learn what we offer and what we are not.",
  alternates: { canonical: "/about" },
  openGraph: { title: "About NSE Academy", url: "/about", type: "website", siteName: SITE_NAME },
};

const OFFERS = [
  { href: "/investor-profiler", title: "Investor profiler quiz", body: "A free 10-question quiz that maps how you invest to a learning path and a personal NSE watchlist." },
  { href: "/companies", title: "NSE company profiles", body: "Plain-English profiles of NSE-listed companies: what they do, their sector, dividend yield and risk rating." },
  { href: "/market-report", title: "Daily market report", body: "After each trading day: gainers, losers, breadth and value traded, with a short story and a lesson." },
  { href: "/brokers-compare", title: "Broker fee comparison", body: "Compare brokerage costs across licensed Kenyan stockbrokers before you open a CDS account." },
  { href: "/calculators", title: "Calculators", body: "Work out trading fees, dividend income and returns before you place an order." },
  { href: "/pricing", title: "Courses and research", body: "Structured courses and deep-dive research for members, from KSh 300 a month." },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About NSE Academy",
          url: abs("/about"),
          about: { "@id": abs("/#organization") },
          isPartOf: { "@id": abs("/#website") },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])} />
      <div className="min-h-screen bg-white text-gray-900 flex flex-col">
        <PublicHeader />
        <main className="flex-grow pt-24 pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">About NSE Academy</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-4">
              NSE Academy is an independent investor-education platform for people investing on the Nairobi Securities
              Exchange (NSE). We help Kenyans understand how the market works, find out what kind of investor they are,
              and choose and track NSE stocks with confidence.
            </p>
            <p className="text-gray-600 leading-relaxed mb-10">
              The platform is built and run by{" "}
              <a href="https://vitaldigitalmedia.net/infinity-digital-works/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">
                Infinity Digital Works
              </a>
              . You may also see it searched for as NSE Digital Academy.
            </p>

            <h2 className="text-2xl font-bold mb-5 border-l-4 border-emerald-600 pl-4">What you can do here</h2>
            <ul className="grid sm:grid-cols-2 gap-4 mb-12">
              {OFFERS.map((o) => (
                <li key={o.href} className="border border-gray-100 rounded-2xl p-5 bg-gray-50">
                  <h3 className="font-bold mb-1.5">
                    <Link href={o.href} className="hover:text-emerald-700">{o.title}</Link>
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{o.body}</p>
                </li>
              ))}
            </ul>

            <h2 className="text-2xl font-bold mb-5 border-l-4 border-emerald-600 pl-4">What NSE Academy is not</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-600 leading-relaxed mb-12">
              <li>
                <strong className="text-gray-800">Not the exchange.</strong> We are not affiliated with, endorsed by or
                officially connected to the Nairobi Securities Exchange PLC.
              </li>
              <li>
                <strong className="text-gray-800">Not a broker.</strong> We do not hold your money or place trades. To buy
                shares you open a CDS account with a licensed stockbroker.
              </li>
              <li>
                <strong className="text-gray-800">Not investment advice.</strong> Everything here is educational. Shares can
                fall as well as rise, so decide for yourself or speak to a licensed adviser.
              </li>
            </ul>

            <h2 className="text-2xl font-bold mb-5 border-l-4 border-emerald-600 pl-4">How our numbers are made</h2>
            <p className="text-gray-600 leading-relaxed mb-12">
              Prices on the site are delayed and for information only. The daily market report is computed from the
              day&apos;s closing prices; its written summary is produced with AI, and every figure in it is checked against
              the data before it is published. Each report says so at the bottom.
            </p>

            <h2 className="text-2xl font-bold mb-5 border-l-4 border-emerald-600 pl-4">Get in touch</h2>
            <p className="text-gray-600 leading-relaxed">
              Questions, feedback or a SACCO or corporate licence enquiry? Use the{" "}
              <Link href="/contact" className="text-emerald-700 hover:underline">contact form</Link>
              , or follow the free daily NSE wrap on our{" "}
              <a href={WHATSAPP_CHANNEL} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">WhatsApp channel</a>.
            </p>
          </div>
        </main>
        <PublicFooter />
      </div>
    </>
  );
}

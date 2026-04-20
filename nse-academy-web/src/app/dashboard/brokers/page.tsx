"use client";

import Link from "next/link";

const BROKERS = [
  {
    name: "AIB AXYS Africa",
    logo: "🏦",
    tagline: "Kenya's trusted online trading platform",
    description:
      "AIB AXYS Africa offers a fully digital account opening experience. Trade NSE equities, bonds, and ETFs from your phone or desktop. Regulated by the Capital Markets Authority (CMA).",
    highlights: [
      "CMA regulated & trusted since 1995",
      "100% online account opening — no paperwork",
      "Trade equities, bonds & ETFs",
      "Mobile app + web trading platform",
      "Competitive brokerage rates",
      "Dedicated customer support",
    ],
    referralUrl: "https://aibaxys.kenyaonlinetrading.com/ActiveTrader/#!/new-trading-account?ReferralCode=REF39870",
    referralCode: "REF39870",
    ctaLabel: "Open Account with AIB AXYS",
    badge: "Recommended",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
];

export default function BrokersPage() {
  function handleOpen(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="max-w-3xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Open a Brokerage Account</h1>
        <p className="text-gray-500">
          Ready to invest? Open a CDS account with one of our trusted broker partners and start buying NSE shares today.
          Your NSE Academy profile has already identified the right stocks for you — now it's time to act.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-emerald-50 rounded-2xl p-5 mb-8 border border-emerald-100">
        <h2 className="font-semibold text-emerald-900 mb-3">How to get started in 3 steps</h2>
        <ol className="space-y-2 text-sm text-emerald-800">
          <li className="flex gap-3"><span className="font-bold shrink-0">1.</span> Click the referral link below to open your account online</li>
          <li className="flex gap-3"><span className="font-bold shrink-0">2.</span> Complete KYC (National ID + phone number — takes ~10 minutes)</li>
          <li className="flex gap-3"><span className="font-bold shrink-0">3.</span> Fund your account via M-Pesa or bank transfer and start trading</li>
        </ol>
      </div>

      {/* Broker cards */}
      <div className="space-y-6">
        {BROKERS.map((broker) => (
          <div key={broker.name} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-2xl border border-gray-100">
                    {broker.logo}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-lg">{broker.name}</h3>
                      {broker.badge && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${broker.badgeColor}`}>
                          {broker.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{broker.tagline}</p>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-5">{broker.description}</p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                {broker.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-emerald-600 shrink-0 mt-0.5">✓</span>
                    {h}
                  </li>
                ))}
              </ul>

              {/* Referral code box */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 flex items-center justify-between gap-4 border border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Your referral code</p>
                  <p className="font-mono font-bold text-gray-900 text-lg tracking-widest">{broker.referralCode}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(broker.referralCode); }}
                  className="text-xs text-emerald-700 hover:text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  Copy code
                </button>
              </div>

              <button
                onClick={() => handleOpen(broker.referralUrl)}
                className="w-full bg-emerald-700 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-800 transition-colors text-sm"
              >
                {broker.ctaLabel} →
              </button>

              <p className="text-center text-xs text-gray-400 mt-3">
                Opens in a new tab · CMA regulated · No hidden fees
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400">
        <strong className="text-gray-500">Disclaimer:</strong> NSE Academy is not a licensed investment advisor.
        Broker links are referral partnerships. Always do your own research before investing.
        Capital Markets Authority (CMA) regulates all licensed stockbrokers in Kenya.
      </div>
    </div>
  );
}

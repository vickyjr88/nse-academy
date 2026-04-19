"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/hooks/useSubscription";
import { TierGate } from "@/components/TierGate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Stock {
  id: number;
  ticker: string;
  company_name: string;
  sector: string;
  description: string;
  dividend_yield: number;
  risk_level: "low" | "medium" | "high";
}

interface AdvisorData {
  investorType: string;
  riskScore: number;
  stocks: Stock[];
  message?: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StocksPage() {
  const router = useRouter();
  const [data, setData] = useState<AdvisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const { tier, loading: subLoading } = useSubscription();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/advisor/recommendations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        setData(json);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  if (subLoading || loading) {
    return <div className="text-center py-20 text-gray-400">Finding your matches…</div>;
  }

  if (tier !== "premium") {
    return (
      <TierGate
        required="premium"
        currentTier={tier}
        loading={false}
        featureName="Stock Advisor"
      >
        {null}
      </TierGate>
    );
  }

  if (!data?.investorType) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-amber-900 mb-4">Profile Incomplete</h1>
          <p className="text-amber-800 mb-8">
            Complete the investor profiler quiz to get personalized NSE stock recommendations.
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center justify-center h-12 px-8 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all"
          >
            Go to Profiler
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Stock Advisor</h1>
        <p className="text-gray-500 mt-2">
          Personalized NSE picks for your <span className="font-bold text-emerald-700 uppercase">{data.investorType}</span> profile (Risk Score: {data.riskScore}/100).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.stocks.map((stock) => (
          <div key={stock.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col hover:border-emerald-200 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="inline-block text-xs font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 mb-1">
                  {stock.ticker}
                </span>
                <h3 className="text-lg font-bold text-gray-900 leading-tight">{stock.company_name}</h3>
              </div>
              <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-full ${
                stock.risk_level === 'high' ? 'bg-red-50 text-red-700' : 
                stock.risk_level === 'medium' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {stock.risk_level} Risk
              </span>
            </div>
            
            <p className="text-sm text-gray-500 line-clamp-3 mb-6 flex-grow">
              {stock.description}
            </p>

            <div className="pt-4 border-t border-gray-50 flex justify-between items-center text-xs text-gray-400">
              <span className="font-medium text-gray-400 uppercase tracking-wider">{stock.sector}</span>
              {stock.dividend_yield > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-400">EST. YIELD</span>
                  <span className="text-emerald-700 font-black text-sm">{stock.dividend_yield}%</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.stocks.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-24 text-center text-gray-400">
          <p>No specific matches found for your criteria yet.</p>
          <p className="text-xs mt-1">Try updating your profile or check back later.</p>
        </div>
      )}
    </div>
  );
}

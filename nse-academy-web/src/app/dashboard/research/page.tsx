"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSubscription } from "@/hooks/useSubscription";
import { TierGate } from "@/components/TierGate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FitRating = "excellent" | "good" | "neutral" | "caution";

interface TickerItem {
  ticker: string;
  company_name: string;
  sector: string;
}

interface TypeAnalysis {
  type: string;
  label: string;
  rating: FitRating;
  reasons: string[];
}

interface ResearchResult {
  company: {
    ticker: string;
    company_name: string;
    sector: string;
    description: string;
    dividend_yield: number;
    risk_level: "low" | "medium" | "high";
  };
  userProfile: { type: string; label: string; riskScore: number } | null;
  userFit: { score: number; verdict: string; reason: string } | null;
  investorTypeAnalysis: TypeAnalysis[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RATING_CONFIG: Record<FitRating, { bg: string; text: string; border: string; badge: string; icon: string }> = {
  excellent: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800", icon: "✅" },
  good: { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200", badge: "bg-blue-100 text-blue-800", icon: "👍" },
  neutral: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", badge: "bg-gray-100 text-gray-700", icon: "➖" },
  caution: { bg: "bg-red-50", text: "text-red-800", border: "border-red-200", badge: "bg-red-100 text-red-800", icon: "⚠️" },
};

const RATING_LABEL: Record<FitRating, string> = {
  excellent: "Excellent Fit",
  good: "Good Fit",
  neutral: "Neutral",
  caution: "Use Caution",
};

const RISK_CONFIG: Record<string, { bg: string; text: string }> = {
  low: { bg: "bg-blue-50", text: "text-blue-700" },
  medium: { bg: "bg-orange-50", text: "text-orange-700" },
  high: { bg: "bg-red-50", text: "text-red-700" },
};

const FIT_SCORE_COLOR = (score: number) =>
  score >= 80 ? "text-emerald-700" : score >= 60 ? "text-blue-700" : score >= 40 ? "text-gray-600" : "text-red-600";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResearchPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const { tier, loading: subLoading } = useSubscription();

  const [tickers, setTickers] = useState<TickerItem[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<TickerItem | null>(null);

  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth + load ticker list
  useEffect(() => {
    const t = localStorage.getItem("access_token");
    if (!t) { router.push("/auth/login"); return; }
    setToken(t);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/advisor/tickers`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((data) => setTickers(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, [router]);

  const filteredTickers = tickers.filter(
    (t) =>
      t.ticker?.toLowerCase().includes(search.toLowerCase()) ||
      t.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.sector?.toLowerCase().includes(search.toLowerCase())
  );

  const runResearch = useCallback(
    async (ticker: string) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/advisor/research?ticker=${encodeURIComponent(ticker)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Research failed");
        setResult(data);
      } catch (err: any) {
        setError(err.message || "Could not load research. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  function handleSelect(item: TickerItem) {
    setSelected(item);
    setSearch(item.company_name);
    setShowDropdown(false);
    runResearch(item.ticker);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (subLoading) {
    return <div className="text-center py-20 text-gray-400">Loading…</div>;
  }

  if (tier !== "premium") {
    return (
      <TierGate
        required="premium"
        currentTier={tier}
        loading={false}
        featureName="Company Research Tool"
      >
        {null}
      </TierGate>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Company Research</h1>
        <p className="text-gray-500 mt-2">
          Select any NSE-listed company to see which investor types should consider it — and how it fits your profile.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm focus-within:border-emerald-400 transition-colors">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); setSelected(null); }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Search by company name, ticker, or sector…"
            className="flex-1 text-gray-900 bg-transparent outline-none text-base placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setSelected(null); setResult(null); setError(null); }}
              className="text-gray-300 hover:text-gray-500 transition-colors text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        {showDropdown && filteredTickers.length > 0 && (
          <ul className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {filteredTickers.slice(0, 20).map((item) => (
              <li key={item.ticker}>
                <button
                  onMouseDown={() => handleSelect(item)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-emerald-50 transition-colors text-left"
                >
                  <span className="font-black text-emerald-700 text-sm w-14 shrink-0">{item.ticker}</span>
                  <span className="text-gray-900 text-sm font-medium flex-1">{item.company_name}</span>
                  <span className="text-gray-400 text-xs shrink-0">{item.sector}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {showDropdown && search.length > 1 && filteredTickers.length === 0 && (
          <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-lg px-5 py-4 text-sm text-gray-400">
            No companies found matching "{search}"
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-4 animate-pulse">🔬</div>
          <p>Analysing {selected?.ticker}…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm text-red-700">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div className="bg-white border border-dashed border-gray-200 rounded-3xl py-24 text-center text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="font-medium text-gray-500">Search for an NSE company above to begin your research</p>
          <p className="text-sm mt-1">We'll show you a full investor-type fit analysis</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">
          {/* Company header card */}
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    {result.company.ticker}
                  </span>
                  <span className="text-xs text-gray-400 uppercase tracking-wider">{result.company.sector}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{result.company.company_name}</h2>
                <p className="text-gray-500 text-sm mt-2 max-w-2xl">{result.company.description}</p>
              </div>

              <div className="flex gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Risk</p>
                  <span className={`text-xs font-black px-3 py-1.5 rounded-full uppercase ${RISK_CONFIG[result.company.risk_level]?.bg} ${RISK_CONFIG[result.company.risk_level]?.text}`}>
                    {result.company.risk_level}
                  </span>
                </div>
                {result.company.dividend_yield > 0 && (
                  <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Est. Yield</p>
                    <p className="text-2xl font-black text-emerald-700">{result.company.dividend_yield}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User fit banner */}
          {result.userFit && result.userProfile && (
            <div className={`rounded-3xl p-6 border ${result.userFit.score >= 70 ? "bg-emerald-50 border-emerald-200" : result.userFit.score >= 50 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    Your Profile: {result.userProfile.label}
                  </p>
                  <h3 className={`text-xl font-black ${FIT_SCORE_COLOR(result.userFit.score)}`}>
                    {result.userFit.verdict}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 max-w-xl">{result.userFit.reason}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Fit Score</p>
                  <p className={`text-5xl font-black ${FIT_SCORE_COLOR(result.userFit.score)}`}>
                    {result.userFit.score}
                    <span className="text-xl text-gray-400">/100</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Investor type analysis */}
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
              Investor Type Fit Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.investorTypeAnalysis.map((analysis) => {
                const cfg = RATING_CONFIG[analysis.rating];
                const isUserType = result.userProfile?.type === analysis.type;
                return (
                  <div
                    key={analysis.type}
                    className={`rounded-2xl p-6 border ${cfg.bg} ${cfg.border} ${isUserType ? "ring-2 ring-emerald-400 ring-offset-2" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{cfg.icon}</span>
                        <span className={`font-bold text-base ${cfg.text}`}>{analysis.label}</span>
                        {isUserType && (
                          <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
                            You
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                        {RATING_LABEL[analysis.rating]}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {analysis.reasons.map((reason, i) => (
                        <li key={i} className={`text-sm flex items-start gap-2 ${cfg.text} opacity-90`}>
                          <span className="shrink-0 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA if no profile */}
          {!result.userProfile && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
              <p className="text-amber-800 font-medium mb-3">
                Complete your investor profiler to see a personalised fit score for this company.
              </p>
              <a
                href="/dashboard/profile"
                className="inline-block bg-amber-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors text-sm"
              >
                Take the Quiz →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

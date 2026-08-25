"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/ebook";
import { useSubscription } from "@/hooks/useSubscription";
import { TierGate } from "@/components/TierGate";
import {
  type RealizedGainsSummary,
  getRealizedGainsSummary,
} from "@/lib/realized-gains";

const KES = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });

function currentYear(): number {
  return new Date().getFullYear();
}

function toCsv(summary: RealizedGainsSummary): string {
  const header = "Date,Ticker,Quantity,Proceeds (KES),Cost Basis (KES),Realized Gain/Loss (KES)";
  const rows = summary.trades.map((t) =>
    [
      new Date(t.tradeDate).toISOString().slice(0, 10),
      t.ticker,
      t.quantity,
      t.proceedsKes.toFixed(2),
      t.costBasisKes.toFixed(2),
      t.realizedGainKes.toFixed(2),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

function downloadCsv(summary: RealizedGainsSummary, year: number | "all") {
  const csv = toCsv(summary);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `realized-gains-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PerformancePage() {
  const router = useRouter();
  const { tier, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | "all">(currentYear());
  const [summary, setSummary] = useState<RealizedGainsSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent("/dashboard/journal/performance")}`);
      return;
    }
    if (subLoading) return;
    if (tier === "free") {
      setLoading(false);
      return;
    }
    setLoading(true);
    getRealizedGainsSummary(year === "all" ? undefined : year)
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, tier, subLoading, year]);

  if (subLoading || loading) {
    return <div className="text-center py-20 text-gray-400">Loading performance…</div>;
  }

  if (tier === "free") {
    return (
      <TierGate required="intermediary" currentTier={tier} loading={false} featureName="Portfolio Performance">
        {null}
      </TierGate>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear() - i);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Link href="/dashboard/journal" className="text-xs text-emerald-600 hover:underline">
            ← Back to journal
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Portfolio Performance</h1>
          <p className="text-gray-500 mt-2 max-w-2xl">
            Realized gains and losses from your closed positions. NSE-listed share trades are currently
            exempt from capital gains tax for individual investors in Kenya, so this is a performance
            reference, not a tax filing — consult your accountant for your specific situation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            <option value="all">All time</option>
          </select>
          {summary && summary.trades.length > 0 && (
            <button
              onClick={() => downloadCsv(summary, year)}
              className="inline-flex items-center justify-center h-11 px-5 font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl transition-all text-sm"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
            <p className="text-xs text-gray-400 uppercase mb-1">Total realized gain/loss</p>
            <p
              className={`text-3xl font-bold ${
                summary.totalRealizedGainKes >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {summary.totalRealizedGainKes >= 0 ? "+" : ""}
              KES {KES.format(summary.totalRealizedGainKes)}
            </p>
          </div>

          <div className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">By ticker</h2>
            {summary.byTicker.length === 0 ? (
              <p className="text-sm text-gray-400">No closed positions in this period.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="px-4 py-3">Ticker</th>
                      <th className="px-4 py-3 text-right">Trades</th>
                      <th className="px-4 py-3 text-right">Proceeds</th>
                      <th className="px-4 py-3 text-right">Cost basis</th>
                      <th className="px-4 py-3 text-right">Gain/loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byTicker.map((t) => (
                      <tr key={t.ticker} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 font-semibold text-gray-900">{t.ticker}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{t.tradeCount}</td>
                        <td className="px-4 py-3 text-right text-gray-900">KES {KES.format(t.proceedsKes)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">KES {KES.format(t.costBasisKes)}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            t.realizedGainKes >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {t.realizedGainKes >= 0 ? "+" : ""}
                          KES {KES.format(t.realizedGainKes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Closed trades</h2>
            {summary.trades.length === 0 ? (
              <p className="text-sm text-gray-400">No closed positions in this period.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Ticker</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Proceeds</th>
                      <th className="px-4 py-3 text-right">Cost basis</th>
                      <th className="px-4 py-3 text-right">Gain/loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.trades.map((t) => (
                      <tr key={t.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(t.tradeDate).toLocaleDateString("en-KE")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{t.ticker}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{t.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-gray-900">KES {KES.format(t.proceedsKes)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">KES {KES.format(t.costBasisKes)}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            t.realizedGainKes >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {t.realizedGainKes >= 0 ? "+" : ""}
                          KES {KES.format(t.realizedGainKes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

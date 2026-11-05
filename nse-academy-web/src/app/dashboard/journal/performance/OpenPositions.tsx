"use client";

import { useCallback, useEffect, useState } from "react";
import { type Portfolio, type PortfolioPosition, getPortfolio, setHoldingCost } from "@/lib/journal";
import { type PortfolioWatch, getPortfolioWatch, setPortfolioWatchEnabled } from "@/lib/portfolio-watch";

const KES = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });
const KES0 = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

const signed = (n: number, f: Intl.NumberFormat = KES0) => `${n >= 0 ? "+" : "-"}${f.format(Math.abs(n))}`;
const tone = (n: number | null) => (n == null ? "text-gray-400" : n >= 0 ? "text-emerald-600" : "text-red-600");

function CostCell({ p, onSaved }: { p: PortfolioPosition; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a price above 0");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await setHoldingCost(p.id, n);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            autoFocus
            onFocus={(e) => e.target.select()}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={`Cost per share for ${p.ticker}`}
            className="w-24 h-8 px-2 border border-gray-300 rounded-md text-sm text-right"
          />
          <button onClick={() => void save()} disabled={saving} className="h-8 px-2.5 text-xs font-semibold bg-emerald-600 text-white rounded-md disabled:opacity-50">
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="h-8 px-2 text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  const estimated = p.costSource === "IMPORT_PRICE";
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-gray-900">{p.avgCost != null ? KES.format(p.avgCost) : "-"}</span>
      {estimated && (
        <span
          className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"
          title={`Estimated from the market price when you imported${p.costDate ? ` (${new Date(p.costDate).toLocaleDateString("en-KE")})` : ""}`}
        >
          est.
        </span>
      )}
      <button
        onClick={() => {
          setValue(p.avgCost != null ? String(p.avgCost) : "");
          setEditing(true);
        }}
        className="text-xs text-emerald-700 hover:underline"
      >
        {p.avgCost == null ? "Add" : "Edit"}
      </button>
    </div>
  );
}

function WatchCard({ watch, onToggle }: { watch: PortfolioWatch; onToggle: (enabled: boolean) => void }) {
  const items = watch.fresh;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-bold text-gray-900">Portfolio watch</h3>
          <p className="text-sm text-gray-500 mt-1">
            After each trading day we check your holdings and flag big moves, stocks near a 60-day high or low, profit
            or loss targets on your cost, and over-concentration. Information only, not advice.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0 cursor-pointer">
          <input type="checkbox" checked={watch.enabled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          Email me
        </label>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing new to flag right now.</p>
      ) : (
        <ul className="space-y-2 text-sm text-gray-700">
          {items.map((i) => (
            <li key={i.key} className="pl-3 border-l-2 border-emerald-500">
              {i.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function OpenPositions() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [watch, setWatch] = useState<PortfolioWatch | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    getPortfolio().then(setPortfolio).catch((e) => setError(e.message));
    getPortfolioWatch().then(setWatch).catch(() => setWatch(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(enabled: boolean) {
    setWatch((w) => (w ? { ...w, enabled } : w));
    try {
      await setPortfolioWatchEnabled(enabled);
    } catch {
      setWatch((w) => (w ? { ...w, enabled: !enabled } : w));
    }
  }

  if (error) {
    return <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>;
  }
  if (!portfolio) return <div className="mb-8 text-sm text-gray-400">Loading your portfolio…</div>;
  if (portfolio.positions.length === 0) {
    return (
      <div className="mb-10 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-sm text-gray-500">
        You have no open positions yet. Log a trade or import a CDSC statement from the{" "}
        <a href="/dashboard/journal" className="text-emerald-700 hover:underline">trade journal</a> and they will show here.
      </div>
    );
  }

  const anyEstimated = portfolio.positions.some((p) => p.costSource === "IMPORT_PRICE");
  const missingCost = portfolio.positions.some((p) => p.avgCost == null);
  const gainPct = portfolio.totalCostBasisKes > 0 && !missingCost ? (portfolio.totalUnrealizedGainKes / portfolio.totalCostBasisKes) * 100 : null;

  return (
    <section className="mb-12">
      <h2 className="text-lg font-bold text-gray-900 mb-1">Open positions</h2>
      <p className="text-sm text-gray-500 mb-4">What you hold now, valued at the latest closing prices.</p>

      {watch && <WatchCard watch={watch} onToggle={toggle} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase mb-1">Market value</p>
          <p className="text-2xl font-bold text-gray-900">KES {KES0.format(portfolio.totalMarketValueKes)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase mb-1">Cost{anyEstimated ? " (partly estimated)" : ""}</p>
          <p className="text-2xl font-bold text-gray-900">{missingCost ? "-" : `KES ${KES0.format(portfolio.totalCostBasisKes)}`}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-xs text-gray-400 uppercase mb-1">Unrealized gain</p>
          {missingCost ? (
            <p className="text-2xl font-bold text-gray-400">-</p>
          ) : (
            <p className={`text-2xl font-bold ${tone(portfolio.totalUnrealizedGainKes)}`}>
              {signed(portfolio.totalUnrealizedGainKes)}
              {gainPct != null && <span className="text-base font-semibold ml-2">({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)</span>}
            </p>
          )}
        </div>
      </div>

      {anyEstimated && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          Costs marked <strong>est.</strong> use the market price on the day you imported your holdings, so gains are
          measured from then. Use <strong>Edit</strong> to enter the price you actually paid.
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3 text-right">Shares</th>
              <th className="px-4 py-3 text-right">Cost / share</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Gain</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positions.map((p) => {
              const pct = p.unrealizedGainKes != null && p.costBasisKes ? (p.unrealizedGainKes / p.costBasisKes) * 100 : null;
              return (
                <tr key={p.id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{p.ticker}</span>
                    <span className="block text-xs text-gray-400">{p.broker.name}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">{p.quantity.toLocaleString("en-KE")}</td>
                  <td className="px-4 py-3 text-right"><CostCell p={p} onSaved={load} /></td>
                  <td className="px-4 py-3 text-right text-gray-900">{p.currentPrice != null ? KES.format(p.currentPrice) : "-"}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{p.marketValueKes != null ? `KES ${KES0.format(p.marketValueKes)}` : "-"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${tone(p.unrealizedGainKes)}`}>
                    {p.unrealizedGainKes != null ? (
                      <>
                        {signed(p.unrealizedGainKes)}
                        {pct != null && <span className="block text-xs font-medium">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

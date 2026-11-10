"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccessToken } from "@/lib/ebook";
import { useSubscription } from "@/hooks/useSubscription";
import { type ModelComparison, compareWithModel, adoptModelAsTargets } from "@/lib/model-portfolios-member";
import { trackEvent } from "@/lib/analytics";

/** What a member can do with a model: see how their own holdings compare, and (Premium) copy its weights as their targets. */
export default function ModelActions({ slug }: { slug: string }) {
  const token = useAccessToken();
  const { tier, loading } = useSubscription();
  const [cmp, setCmp] = useState<ModelComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  if (!token) {
    return (
      <p className="text-sm text-gray-600">
        <Link href="/auth/register" className="font-semibold text-emerald-700 underline">Create a free account</Link> to compare your own holdings with this model.
      </p>
    );
  }
  if (loading) return null;

  async function compare() {
    setBusy(true);
    setMsg(null);
    try {
      setCmp(await compareWithModel(slug));
      trackEvent("model_portfolio_compared", { slug });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not compare.", bad: true });
    } finally {
      setBusy(false);
    }
  }

  async function adopt() {
    setBusy(true);
    setMsg(null);
    try {
      await adoptModelAsTargets(slug);
      trackEvent("model_portfolio_adopted", { slug });
      setMsg({ text: "Done. These weights are now your targets." });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Could not save.", bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {tier === "free" ? (
          <Link href="/dashboard/billing" className="rounded-xl border border-emerald-700 px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Upgrade to compare with your holdings</Link>
        ) : (
          <button type="button" onClick={compare} disabled={busy} className="rounded-xl border border-emerald-700 px-5 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">Compare with my holdings</button>
        )}
        {tier === "premium" ? (
          <button type="button" onClick={adopt} disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60">Use as my target weights</button>
        ) : tier === "intermediary" ? (
          <span className="text-sm text-gray-600">Premium lets you use this as your target weights.</span>
        ) : null}
      </div>
      {msg ? (
        <p className={`mt-3 text-sm ${msg.bad ? "text-red-600" : "text-emerald-700"}`}>
          {msg.text} {!msg.bad ? <Link href="/dashboard/journal/allocation" className="font-medium underline">See your rebalancing plan</Link> : null}
        </p>
      ) : null}
      {cmp ? (
        <div className="mt-5">
          {!cmp.hasHoldings ? (
            <p className="text-sm text-gray-600">You have no holdings yet, so there is nothing to compare. <Link href="/dashboard/journal" className="font-medium text-emerald-700 underline">Log a trade or import a statement</Link>.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-700">Your portfolio already matches <strong>{cmp.overlapPct.toFixed(1)}%</strong> of this model.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-2 pr-3 font-semibold">Stock</th>
                      <th className="py-2 pr-3 text-right font-semibold">Model</th>
                      <th className="py-2 pr-3 text-right font-semibold">You</th>
                      <th className="py-2 text-right font-semibold">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cmp.rows.map((r) => (
                      <tr key={r.ticker} className="border-b border-gray-100 last:border-0">
                        <td className="py-2 pr-3 font-semibold text-gray-900">{r.ticker}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.modelPct.toFixed(1)}%</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.yourPct.toFixed(1)}%</td>
                        <td className={`py-2 text-right tabular-nums ${Math.abs(r.diffPct) >= 2 ? (r.diffPct > 0 ? "text-amber-700" : "text-sky-700") : "text-gray-600"}`}>{r.diffPct > 0 ? "+" : ""}{r.diffPct.toFixed(1)} pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cmp.notInModel.length > 0 ? <p className="mt-3 text-sm text-gray-600">Not in this model: {cmp.notInModel.map((n) => `${n.ticker} (${n.weightPct.toFixed(1)}%)`).join(", ")}.</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

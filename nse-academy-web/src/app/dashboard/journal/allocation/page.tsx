"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TierGate } from "@/components/TierGate";
import { useSubscription } from "@/hooks/useSubscription";
import { getAccessToken } from "@/lib/ebook";
import { type AllocationOverview, type RebalancePlan, getAllocation, getRebalance, saveTargets } from "@/lib/allocation";

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString("en-KE")}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

export default function AllocationPage() {
  const router = useRouter();
  const { tier, loading: subLoading } = useSubscription();
  const [data, setData] = useState<AllocationOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [cash, setCash] = useState("");
  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const premium = tier === "premium";

  const load = useCallback(() => {
    getAllocation()
      .then((d) => {
        setData(d);
        setWeights(Object.fromEntries(d.targets.map((t) => [t.ticker, String(t.weightPct)])));
        setExtra(d.targets.map((t) => t.ticker).filter((t) => !d.rows.some((r) => r.ticker === t)));
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/auth/login");
      return;
    }
    if (subLoading) return;
    if (tier === "free") return;
    load();
  }, [router, tier, subLoading, load]);

  const tickers = useMemo(() => [...(data?.rows.map((r) => r.ticker) ?? []), ...extra], [data, extra]);
  const total = useMemo(() => tickers.reduce((s, t) => s + (Number(weights[t]) || 0), 0), [tickers, weights]);
  const hasAny = tickers.some((t) => Number(weights[t]) > 0);
  const balanced = Math.abs(total - 100) <= 0.5;

  function equalWeights() {
    const active = tickers;
    if (!active.length) return;
    const each = Math.floor((10000 / active.length)) / 100;
    const next: Record<string, string> = {};
    active.forEach((t, i) => {
      next[t] = String(i === active.length - 1 ? Math.round((100 - each * (active.length - 1)) * 100) / 100 : each);
    });
    setWeights(next);
    setSaveMsg(null);
  }

  function addTicker() {
    const t = newTicker.trim().toUpperCase();
    if (!/^[A-Z0-9.]{1,12}$/.test(t) || tickers.includes(t)) return;
    setExtra((e) => [...e, t]);
    setNewTicker("");
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const targets = tickers.map((t) => ({ ticker: t, weightPct: Number(weights[t]) || 0 })).filter((t) => t.weightPct > 0);
      await saveTargets(targets);
      setSaveMsg({ text: targets.length ? "Targets saved." : "Targets cleared." });
      setPlan(null);
      load();
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : "Could not save.", bad: true });
    } finally {
      setSaving(false);
    }
  }

  async function calculate() {
    setPlanning(true);
    setPlanError(null);
    try {
      setPlan(await getRebalance(Number(cash.replace(/,/g, "")) || 0));
    } catch (e) {
      setPlanError(e instanceof Error ? e.message : "Could not work that out.");
    } finally {
      setPlanning(false);
    }
  }

  if (subLoading || (tier !== "free" && loading)) return <div className="text-center py-20 text-gray-400">Loading allocation…</div>;
  if (tier === "free") {
    return (
      <TierGate required="intermediary" currentTier={tier} loading={false} featureName="Portfolio Allocation">
        {null}
      </TierGate>
    );
  }
  if (error || !data) return <div className="max-w-xl mx-auto py-16 text-center text-red-600">Could not load your allocation: {error}</div>;

  const driftOf = (t: string) => data.targets.find((x) => x.ticker === t);
  const rowFor = (t: string) => data.rows.find((r) => r.ticker === t);
  const maxWeight = Math.max(1, ...data.rows.map((r) => r.weightPct));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard/journal" className="text-xs text-emerald-600 hover:underline">← Back to journal</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Portfolio Allocation</h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Where your money sits, by stock and by sector, at last close. {premium ? "Set the weights you want, and see what it would take to get there, with your broker's fees." : "Premium adds target weights and a rebalancing plan."} Information only, not investment advice. <Link href="/model-portfolios" className="font-medium text-emerald-700 underline">Browse model portfolios</Link> for a starting point.
        </p>
      </div>

      {data.rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-600">
          You have no holdings yet. <Link href="/dashboard/journal" className="font-medium text-emerald-700 underline">Log a trade or import a CDSC statement</Link> to see your allocation.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Portfolio value</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{kes(data.valueKes)}</p>
            {data.notes.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-gray-700">
                {data.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            ) : null}
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">By stock</h2>
              {premium ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={`font-semibold tabular-nums ${balanced || !hasAny ? "text-gray-700" : "text-red-600"}`}>Targets add up to {total.toFixed(1)}%</span>
                  <button type="button" onClick={equalWeights} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">Equal weights</button>
                </div>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-semibold">Stock</th>
                    <th className="py-2 pr-3 font-semibold">Sector</th>
                    <th className="py-2 pr-3 font-semibold">Weight</th>
                    <th className="py-2 pr-3 text-right font-semibold">Value</th>
                    {premium ? <th className="py-2 pr-3 text-right font-semibold">Target %</th> : null}
                    {premium ? <th className="py-2 text-right font-semibold">Off by</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {tickers.map((t) => {
                    const r = rowFor(t);
                    const saved = driftOf(t);
                    const off = r && saved ? r.weightPct - saved.weightPct : null;
                    return (
                      <tr key={t} className="border-b border-gray-100 last:border-0">
                        <td className="py-2.5 pr-3 font-semibold text-gray-900">{t}{!r ? <span className="ml-2 text-xs font-normal text-gray-500">not held</span> : null}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{r?.sector ?? "-"}</td>
                        <td className="py-2.5 pr-3">
                          {r ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-28 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(r.weightPct / maxWeight) * 100}%` }} /></div>
                              <span className="tabular-nums text-gray-700">{pct(r.weightPct)}</span>
                            </div>
                          ) : <span className="text-gray-400">0.0%</span>}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{r ? kes(r.valueKes) : "-"}</td>
                        {premium ? (
                          <td className="py-2.5 pr-3 text-right">
                            <input
                              id={`target-${t}`}
                              aria-label={`Target weight for ${t}`}
                              inputMode="decimal"
                              value={weights[t] ?? ""}
                              onChange={(e) => { setWeights((w) => ({ ...w, [t]: e.target.value })); setSaveMsg(null); }}
                              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="0"
                            />
                          </td>
                        ) : null}
                        {premium ? (
                          <td className={`py-2.5 text-right tabular-nums ${off == null ? "text-gray-400" : Math.abs(off) >= 2 ? (off > 0 ? "text-amber-700" : "text-sky-700") : "text-gray-600"}`}>
                            {off == null ? "-" : `${off >= 0 ? "+" : ""}${off.toFixed(1)} pts`}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {premium ? (
              <div className="mt-5 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="new-ticker" className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Add a stock you want to hold</label>
                  <input id="new-ticker" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTicker()} placeholder="e.g. EQTY" className="mt-1 w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <button type="button" onClick={addTicker} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">Add</button>
                <button type="button" onClick={save} disabled={saving || (hasAny && !balanced)} className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {saving ? "Saving…" : hasAny ? "Save targets" : "Clear targets"}
                </button>
                {saveMsg ? <span className={`text-sm ${saveMsg.bad ? "text-red-600" : "text-emerald-700"}`}>{saveMsg.text}</span> : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">By sector</h2>
            <ul className="space-y-3">
              {data.sectors.map((s) => (
                <li key={s.sector}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-gray-900">{s.sector}</span>
                    <span className="tabular-nums text-gray-600">{pct(s.weightPct)} &middot; {s.tickers.join(", ")}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-sky-600" style={{ width: `${Math.min(s.weightPct, 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </section>

          {premium ? (
            <section className="rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="text-lg font-bold text-gray-900">What it would take to reach your targets</h2>
              <p className="mt-1 text-sm text-gray-600">Stocks within 2 percentage points of their target are left alone, and trades under KSh 1,000 are skipped. Holdings without a target are not touched.</p>
              {data.targets.length === 0 ? (
                <p className="mt-4 text-sm text-gray-600">Save your target weights above first.</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div>
                      <label htmlFor="cash" className="block text-xs font-semibold uppercase tracking-wide text-gray-500">New cash to invest (optional, KSh)</label>
                      <input id="cash" inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" className="mt-1 w-44 rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <button type="button" onClick={calculate} disabled={planning} className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{planning ? "Working it out…" : "Show the trades"}</button>
                  </div>
                  {planError ? <p className="mt-3 text-sm text-red-600">{planError}</p> : null}
                  {plan ? (
                    <div className="mt-5">
                      {plan.trades.length === 0 ? (
                        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Nothing needs to change: every stock is within 2 percentage points of its target.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[560px] text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                                <th className="py-2 pr-3 font-semibold">Action</th>
                                <th className="py-2 pr-3 font-semibold">Stock</th>
                                <th className="py-2 pr-3 text-right font-semibold">Shares</th>
                                <th className="py-2 pr-3 text-right font-semibold">Price</th>
                                <th className="py-2 pr-3 text-right font-semibold">Value</th>
                                <th className="py-2 pr-3 text-right font-semibold">Fee</th>
                                <th className="py-2 text-right font-semibold">Weight</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.trades.map((t) => (
                                <tr key={t.ticker} className="border-b border-gray-100 last:border-0">
                                  <td className={`py-2.5 pr-3 font-semibold ${t.action === "SELL" ? "text-red-600" : "text-emerald-700"}`}>{t.action === "SELL" ? "Sell" : "Buy"}</td>
                                  <td className="py-2.5 pr-3 font-semibold text-gray-900">{t.ticker}{t.brokerName ? <span className="ml-2 text-xs font-normal text-gray-500">{t.brokerName}</span> : null}</td>
                                  <td className="py-2.5 pr-3 text-right tabular-nums">{t.shares.toLocaleString("en-KE")}</td>
                                  <td className="py-2.5 pr-3 text-right tabular-nums">{t.priceKes.toFixed(2)}</td>
                                  <td className="py-2.5 pr-3 text-right tabular-nums">{kes(t.valueKes)}</td>
                                  <td className="py-2.5 pr-3 text-right tabular-nums">{t.feeKes != null ? kes(t.feeKes) : "-"}</td>
                                  <td className="py-2.5 text-right tabular-nums text-gray-600">{t.fromPct.toFixed(1)}% → {t.toPct.toFixed(1)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="mt-4 text-sm text-gray-700">
                        Broker fees about <strong>{kes(plan.totalFeesKes)}</strong> ({plan.feesPctOfBase.toFixed(1)}% of {kes(plan.baseKes)}). {plan.netCashKes < -1 ? <>The buys are <strong>{kes(-plan.netCashKes)}</strong> more than the sells and your cash cover.</> : <>Cash left after the trades: <strong>{kes(plan.netCashKes)}</strong>.</>}
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                        {plan.warnings.map((w) => <li key={w}>{w}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 text-sm text-emerald-900">
              <strong>Premium</strong> lets you set target weights, see how far each stock has drifted, and get the trades and broker fees it would take to rebalance, plus a quarterly review email.{" "}
              <Link href="/dashboard/billing" className="font-semibold underline">See Premium</Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}

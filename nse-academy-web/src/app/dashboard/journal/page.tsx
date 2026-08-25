"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/ebook";
import { useSubscription } from "@/hooks/useSubscription";
import { TierGate } from "@/components/TierGate";
import {
  type Broker,
  type CreateTradeInput,
  type Portfolio,
  type Trade,
  createTrade,
  deleteTrade,
  getPortfolio,
  importStatement,
  listBrokers,
  listTrades,
} from "@/lib/journal";
import { type PriceAlert, deleteAlert, listAlerts } from "@/lib/alerts";

const KES = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });

function emptyForm(): CreateTradeInput {
  return {
    brokerId: "",
    ticker: "",
    side: "BUY",
    quantity: 0,
    pricePerShare: 0,
    tradeDate: new Date().toISOString().slice(0, 10),
  };
}

export default function JournalPage() {
  const router = useRouter();
  const { tier, loading: subLoading } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateTradeInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    const [t, b, p, a] = await Promise.all([listTrades(), listBrokers(), getPortfolio(), listAlerts()]);
    setTrades(t);
    setBrokers(b);
    setPortfolio(p);
    setAlerts(a);
  }

  async function handleDeleteAlert(id: string) {
    await deleteAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent("/dashboard/journal")}`);
      return;
    }
    if (subLoading) return;
    if (tier === "free") {
      setLoading(false);
      return;
    }
    loadAll()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router, tier, subLoading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await createTrade({ ...form, ticker: form.ticker.toUpperCase() });
      setForm(emptyForm());
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trade");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this trade?")) return;
    await deleteTrade(id);
    await loadAll();
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportMessage("");
    setError("");
    try {
      const result = await importStatement(file);
      setImportMessage(`Imported ${result.holdingsRead} holding(s) from ${result.filename}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import statement");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const selectedBroker = brokers.find((b) => b.id === form.brokerId);
  const estimatedFees =
    selectedBroker && form.quantity && form.pricePerShare
      ? (form.quantity * form.pricePerShare * selectedBroker.feePercent) / 100
      : 0;

  if (subLoading || loading) {
    return <div className="text-center py-20 text-gray-400">Loading your journal…</div>;
  }

  if (tier === "free") {
    return (
      <TierGate required="intermediary" currentTier={tier} loading={false} featureName="Trade Journal">
        {null}
      </TierGate>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trade Journal</h1>
          <p className="text-gray-500 mt-2">
            Track every trade across your brokers and see your portfolio and cost basis in one place.
          </p>
        </div>
        <div className="flex gap-3">
          <label className="inline-flex items-center justify-center h-11 px-5 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all cursor-pointer text-sm">
            {importing ? "Importing…" : "Import CDSC Statement"}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
            />
          </label>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center justify-center h-11 px-5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all text-sm"
          >
            {showForm ? "Cancel" : "+ Log Trade"}
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          {importMessage}
        </div>
      )}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Broker</label>
            <select
              required
              value={form.brokerId}
              onChange={(e) => setForm({ ...form, brokerId: e.target.value })}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">Select broker…</option>
              {brokers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.feePercent}% fee)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Ticker</label>
            <input
              required
              value={form.ticker}
              onChange={(e) => setForm({ ...form, ticker: e.target.value })}
              placeholder="e.g. SCOM"
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Side</label>
            <select
              value={form.side}
              onChange={(e) => setForm({ ...form, side: e.target.value as "BUY" | "SELL" })}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            >
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Quantity</label>
            <input
              required
              type="number"
              min={1}
              value={form.quantity || ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Price per share (KES)</label>
            <input
              required
              type="number"
              min={0.01}
              step={0.01}
              value={form.pricePerShare || ""}
              onChange={(e) => setForm({ ...form, pricePerShare: Number(e.target.value) })}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Trade date</label>
            <input
              required
              type="date"
              value={form.tradeDate}
              onChange={(e) => setForm({ ...form, tradeDate: e.target.value })}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {selectedBroker && (
            <div className="lg:col-span-3 text-xs text-gray-500">
              Estimated fees at {selectedBroker.feePercent}%: KES {KES.format(estimatedFees)}
            </div>
          )}

          <div className="lg:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Notes (optional)</label>
            <input
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <div className="lg:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all text-sm"
            >
              {saving ? "Saving…" : "Save Trade"}
            </button>
          </div>
        </form>
      )}

      {/* Portfolio summary */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Portfolio</h2>
        {portfolio && portfolio.positions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolio.positions.map((p) => (
              <div
                key={`${p.broker.id}-${p.ticker}`}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                    {p.ticker}
                  </span>
                  <span className="text-[10px] text-gray-400 uppercase">{p.broker.name}</span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{p.companyName || p.ticker}</p>
                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-500">Qty</span>
                  <span className="font-semibold text-gray-900">{p.quantity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Avg cost</span>
                  <span className="font-semibold text-gray-900">
                    {p.avgCost != null ? `KES ${KES.format(p.avgCost)}` : "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cost basis</span>
                  <span className="font-semibold text-gray-900">
                    {p.costBasisKes != null ? `KES ${KES.format(p.costBasisKes)}` : "-"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            No holdings yet. Log a trade or import a CDSC statement to get started.
          </p>
        )}
      </div>

      {/* Trade history */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Trade History</h2>
        {trades.length === 0 ? (
          <p className="text-sm text-gray-400">No trades logged yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Fees</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(t.tradeDate).toLocaleDateString("en-KE")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{t.ticker}</td>
                    <td className="px-4 py-3 text-gray-500">{t.broker.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          t.side === "BUY" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {t.side}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{t.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{KES.format(t.pricePerShare)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{KES.format(t.feesKes)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {KES.format(t.totalKes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Price alerts */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-gray-900 mb-4">My Alerts</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-gray-400">
            No alerts set. Set one from the Stock Advisor to get notified when a price target is hit.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm divide-y divide-gray-50">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                    {a.ticker}
                  </span>
                  <span className="text-sm text-gray-700">
                    {a.direction === "ABOVE" ? "Above ↑" : "Below ↓"} KES {KES.format(a.targetPrice)}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                      a.status === "triggered"
                        ? "bg-blue-50 text-blue-700"
                        : a.status === "pending"
                          ? "bg-gray-50 text-gray-500"
                          : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteAlert(a.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

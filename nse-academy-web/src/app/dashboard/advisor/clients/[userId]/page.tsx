"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { type ClientProfile, getClientProfile, sendAlert } from "@/lib/advisor";

const CHART_COLORS = ["#047857", "#10b981", "#34d399", "#6ee7b7", "#059669", "#065f46", "#0d9488", "#14b8a6"];

function kes(n: number | null | undefined): string {
  if (n == null) return "—";
  return `KSh ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-red-600" : "text-gray-900";
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex-1 min-w-[160px]">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
}

export default function ClientProfilePage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alertTicker, setAlertTicker] = useState("");
  const [alertAction, setAlertAction] = useState<"BUY" | "SELL">("BUY");
  const [alertMessage, setAlertMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getClientProfile(params.userId)
      .then(setClient)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load client"))
      .finally(() => setLoading(false));
  }, [params.userId]);

  async function handleQuickAlert(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setSent(false);
    try {
      await sendAlert({ ticker: alertTicker.toUpperCase(), action: alertAction, message: alertMessage });
      setSent(true);
      setAlertTicker("");
      setAlertMessage("");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading…</div>;

  if (error || !client) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-red-600 mb-4">{error || "Client not found"}</p>
        <button onClick={() => router.push("/dashboard/advisor")} className="text-emerald-700 font-medium hover:underline">
          ← Back to clients
        </button>
      </div>
    );
  }

  const allocationData = client.portfolio.holdings
    .filter((h) => h.marketValueKes != null && h.marketValueKes > 0)
    .map((h) => ({ name: h.ticker, value: h.marketValueKes as number }));

  const gainTone =
    client.portfolio.totalUnrealizedGainKes > 0
      ? "positive"
      : client.portfolio.totalUnrealizedGainKes < 0
        ? "negative"
        : "neutral";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={() => router.push("/dashboard/advisor")} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
        ← Back to clients
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 rounded-3xl p-8 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-emerald-100">{client.email}{client.phone ? ` · ${client.phone}` : ""}</p>
            <p className="text-emerald-200 text-sm mt-1">
              Client since {new Date(client.createdAt).toLocaleDateString()}
            </p>
          </div>
          {client.investorProfile && (
            <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-3 text-center">
              <p className="text-xs text-emerald-100 uppercase tracking-wide">Investor type</p>
              <p className="text-lg font-bold capitalize">{client.investorProfile.type}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <StatCard label="Portfolio value" value={kes(client.portfolio.totalMarketValueKes)} />
        <StatCard label="Unrealized gain/loss" value={kes(client.portfolio.totalUnrealizedGainKes)} tone={gainTone} />
        <StatCard
          label="Realized gain/loss"
          value={kes(client.totalRealizedGainKes)}
          tone={client.totalRealizedGainKes > 0 ? "positive" : client.totalRealizedGainKes < 0 ? "negative" : "neutral"}
        />
        <StatCard label="Lessons completed" value={client.lessonsCompleted} />
      </div>

      {/* Portfolio */}
      {client.portfolio.holdingsCount === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-500">
          No holdings recorded yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Allocation</h3>
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {allocationData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => kes(typeof v === "number" ? v : Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl p-6 overflow-x-auto">
            <h3 className="font-semibold text-gray-900 mb-4">Holdings</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">Ticker</th>
                  <th className="pb-3 font-medium">Qty</th>
                  <th className="pb-3 font-medium">Avg cost</th>
                  <th className="pb-3 font-medium">Value</th>
                  <th className="pb-3 font-medium">Gain/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {client.portfolio.holdings.map((h) => (
                  <tr key={h.ticker}>
                    <td className="py-3 font-medium text-gray-900">{h.ticker}</td>
                    <td className="py-3 text-gray-700">{h.quantity.toLocaleString()}</td>
                    <td className="py-3 text-gray-700">{h.avgCost != null ? kes(h.avgCost) : "—"}</td>
                    <td className="py-3 text-gray-700">{kes(h.marketValueKes)}</td>
                    <td className={`py-3 font-medium ${h.unrealizedGainKes != null && h.unrealizedGainKes < 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {kes(h.unrealizedGainKes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Investor profile */}
      {client.investorProfile && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Investor profile</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-gray-900 capitalize">{client.investorProfile.type}</p>
              <p className="text-xs text-gray-500 mt-1">Type</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-gray-900">{client.investorProfile.riskScore}/100</p>
              <p className="text-xs text-gray-500 mt-1">Risk score</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-gray-900">{client.investorProfile.horizonYears} yrs</p>
              <p className="text-xs text-gray-500 mt-1">Horizon</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-gray-900">{client.investorProfile.capitalRange}</p>
              <p className="text-xs text-gray-500 mt-1">Capital range</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick alert */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Send an alert</h3>
        <p className="text-sm text-gray-500 mb-4">
          This still broadcasts to every eligible client for a sell alert (only holders of the ticker
          receive it) or all accepted clients for a buy alert — it is not limited to {client.name} alone.
        </p>
        <form onSubmit={handleQuickAlert} className="space-y-3">
          <div className="flex gap-3">
            <input
              required
              value={alertTicker}
              onChange={(e) => setAlertTicker(e.target.value)}
              placeholder="Ticker"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={alertAction}
              onChange={(e) => setAlertAction(e.target.value as "BUY" | "SELL")}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </div>
          <textarea
            required
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
            rows={2}
            placeholder="Message"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {sent && <p className="text-sm text-emerald-700">Alert sent.</p>}
          <button
            type="submit"
            disabled={sending}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              alertAction === "BUY" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {sending ? "Sending…" : `Send ${alertAction.toLowerCase()} alert`}
          </button>
        </form>
      </div>
    </div>
  );
}

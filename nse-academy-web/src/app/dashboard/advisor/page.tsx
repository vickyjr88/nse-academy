"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type AdvisorProfile,
  type AdvisorClientRow,
  type AdvisorQuery,
  type AdvisorInsight,
  type AdvisorAlert,
  getMyAdvisorProfile,
  registerAsAdvisor,
  listMyClients,
  respondToConnection,
  listQueriesForAdvisor,
  publishInsight,
  listMyInsights,
  sendAlert,
  listMyAlerts,
} from "@/lib/advisor";

type Tab = "clients" | "queries" | "insights" | "alerts";

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [credentials, setCredentials] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await registerAsAdvisor({
        headline,
        bio,
        specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
        credentials: credentials || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-8">
      <div className="bg-white border border-gray-100 rounded-2xl p-8">
        <div className="text-4xl mb-4 text-center">🧑‍💼</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Become a Financial Advisor</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          List your services on NSE Academy, connect with clients, and share insights and alerts.
          If you already run a corporate organization, your existing members are added as clients
          automatically.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
            <input
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Certified Financial Planner, 10+ years"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              required
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="I help Kenyan investors build long-term, diversified NSE portfolios..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialties (comma separated)</label>
            <input
              value={specialties}
              onChange={(e) => setSpecialties(e.target.value)}
              placeholder="Retirement Planning, Dividend Investing"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Credentials (optional)</label>
            <input
              value={credentials}
              onChange={(e) => setCredentials(e.target.value)}
              placeholder="CFA, CISI"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-700 text-white py-3 rounded-xl font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
          >
            {loading ? "Registering…" : "Register as advisor"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ClientsTab() {
  const [clients, setClients] = useState<AdvisorClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listMyClients().then(setClients).finally(() => setLoading(false));
  }, []);

  async function handleRespond(row: AdvisorClientRow, accept: boolean) {
    const updated = await respondToConnection(row.id, accept);
    setClients((prev) => prev.map((c) => (c.id === row.id ? updated : c)));
  }

  if (loading) return <div className="text-gray-400 py-8 text-center">Loading…</div>;

  const pending = clients.filter((c) => c.status === "pending");
  const accepted = clients.filter((c) => c.status === "accepted");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Pending requests ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map((row) => (
              <div key={row.id} className="flex items-center justify-between bg-amber-50 rounded-xl p-4">
                <div>
                  <p className="font-medium text-gray-900">{row.user?.name}</p>
                  <p className="text-sm text-gray-500">{row.user?.email}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(row, true)}
                    className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(row, false)}
                    className="text-sm bg-gray-100 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Clients ({accepted.length})</h3>
        {accepted.length === 0 ? (
          <p className="text-sm text-gray-500">No accepted clients yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {accepted.map((row) => (
              <Link
                key={row.id}
                href={`/dashboard/advisor/clients/${row.userId}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{row.user?.name}</p>
                  <p className="text-sm text-gray-500">{row.user?.email}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {row.source === "org_member" ? "Org member" : "Connected"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QueriesTab() {
  const [queries, setQueries] = useState<AdvisorQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listQueriesForAdvisor().then(setQueries).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 py-8 text-center">Loading…</div>;

  const open = queries.filter((q) => q.status === "open");
  const answered = queries.filter((q) => q.status === "answered");

  function QueryRow({ q }: { q: AdvisorQuery }) {
    return (
      <Link
        href={`/dashboard/advisor/queries/${q.id}`}
        className="flex items-center justify-between bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
      >
        <div>
          <p className="text-sm text-gray-500 mb-1">{q.user?.name}</p>
          <p className="text-gray-900">{q.subject}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0 ml-4">
          {q._count?.messages ?? 0} message{(q._count?.messages ?? 0) === 1 ? "" : "s"}
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Open questions ({open.length})</h3>
        {open.length === 0 ? (
          <p className="text-sm text-gray-500">No open questions.</p>
        ) : (
          <div className="space-y-3">
            {open.map((q) => <QueryRow key={q.id} q={q} />)}
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Answered ({answered.length})</h3>
        {answered.length === 0 ? (
          <p className="text-sm text-gray-500">No answered conversations yet.</p>
        ) : (
          <div className="space-y-3">
            {answered.map((q) => <QueryRow key={q.id} q={q} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsTab() {
  const [insights, setInsights] = useState<AdvisorInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tickers, setTickers] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyInsights().then(setInsights).finally(() => setLoading(false));
  }, []);

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setPublishing(true);
    setError("");
    try {
      const insight = await publishInsight({
        title,
        body,
        tickers: tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean),
      });
      setInsights((prev) => [insight, ...prev]);
      setTitle("");
      setBody("");
      setTickers("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Publish an insight</h3>
        <form onSubmit={handlePublish} className="space-y-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Write your insight…"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            placeholder="Related tickers, comma separated (optional)"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={publishing}
            className="bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
          >
            {publishing ? "Publishing…" : "Publish & notify clients"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">History</h3>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : insights.length === 0 ? (
          <p className="text-sm text-gray-500">No insights published yet.</p>
        ) : (
          <div className="space-y-4">
            {insights.map((i) => (
              <div key={i.id} className="border-b border-gray-50 pb-4 last:border-0">
                <p className="font-medium text-gray-900">{i.title}</p>
                <p className="text-sm text-gray-500 mt-1">{i.body}</p>
                <p className="text-xs text-gray-400 mt-2">{new Date(i.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertsTab() {
  const [alerts, setAlerts] = useState<AdvisorAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [action, setAction] = useState<"BUY" | "SELL">("BUY");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyAlerts().then(setAlerts).finally(() => setLoading(false));
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const alert = await sendAlert({ ticker: ticker.toUpperCase(), action, message });
      setAlerts((prev) => [alert, ...prev]);
      setTicker("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-2">Send a buy/sell alert</h3>
        <p className="text-sm text-gray-500 mb-4">
          Buy alerts go to all your accepted clients. Sell alerts only go to clients who currently hold
          that ticker in their portfolio.
        </p>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="flex gap-3">
            <input
              required
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Ticker, e.g. SCOM"
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as "BUY" | "SELL")}
              className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </div>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Why this call?"
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
              action === "BUY" ? "bg-emerald-700 hover:bg-emerald-800" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {sending ? "Sending…" : `Send ${action.toLowerCase()} alert`}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">History</h3>
        {loading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-gray-500">No alerts sent yet.</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0">
                <div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full mr-2 ${
                      a.action === "BUY" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {a.action}
                  </span>
                  <span className="font-medium text-gray-900">{a.ticker}</span>
                  <p className="text-sm text-gray-500 mt-1">{a.message}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-4">{a.recipientCount} recipients</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdvisorWorkspacePage() {
  const [profile, setProfile] = useState<AdvisorProfile | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("clients");

  useEffect(() => {
    getMyAdvisorProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  if (profile === undefined) {
    return <div className="text-gray-400 py-20 text-center">Loading…</div>;
  }

  if (!profile) {
    return <RegisterForm onDone={() => getMyAdvisorProfile().then(setProfile)} />;
  }

  if (profile.approvalStatus !== "approved") {
    const pending = profile.approvalStatus === "pending";
    return (
      <div className="max-w-2xl mx-auto">
        <div className={`border rounded-2xl p-6 text-center ${pending ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
          <span className="text-3xl">{pending ? "⏳" : "⚠️"}</span>
          <h2 className="text-lg font-bold text-gray-900 mt-3">
            {pending ? "Your advisor profile is pending approval" : "Your advisor profile has been suspended"}
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            {pending
              ? "An NSE Academy admin needs to review your profile before it's listed in the advisor directory and you can accept clients. You'll get an email once you're approved."
              : "Your advisor profile is currently suspended and is not visible in the directory. Contact NSE Academy support if you believe this is a mistake."}
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "clients", label: "Clients" },
    { key: "queries", label: "Queries" },
    { key: "insights", label: "Insights" },
    { key: "alerts", label: "Alerts" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-emerald-200 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧑‍💼</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile.headline}</h2>
            <p className="text-sm text-gray-500">
              {profile.isPublic ? "Listed on the public advisor directory" : "Not publicly listed"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "clients" && <ClientsTab />}
      {tab === "queries" && <QueriesTab />}
      {tab === "insights" && <InsightsTab />}
      {tab === "alerts" && <AlertsTab />}
    </div>
  );
}

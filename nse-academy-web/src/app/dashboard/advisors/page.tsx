"use client";

import { useEffect, useState } from "react";
import {
  type AdvisorProfile,
  type AdvisorClientRow,
  listMyConnections,
  requestConnection,
  submitQuery,
} from "@/lib/advisor";
import { listPublicAdvisors } from "@/lib/advisor-public";

function statusBadge(status?: string) {
  if (status === "accepted") return <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Connected</span>;
  if (status === "pending") return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Pending</span>;
  if (status === "declined") return <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Declined</span>;
  return null;
}

export default function DashboardAdvisorsPage() {
  const [advisors, setAdvisors] = useState<AdvisorProfile[]>([]);
  const [connections, setConnections] = useState<AdvisorClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
  const [askingId, setAskingId] = useState<string | null>(null);
  const [sentQuestion, setSentQuestion] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPublicAdvisors({ limit: 100 }), listMyConnections()])
      .then(([advisorsRes, connectionsRes]) => {
        setAdvisors(advisorsRes.data);
        setConnections(connectionsRes);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleConnect(advisorId: string) {
    setConnecting(advisorId);
    try {
      const row = await requestConnection(advisorId);
      setConnections((prev) => [...prev, row]);
    } finally {
      setConnecting(null);
    }
  }

  async function handleAsk(advisorId: string) {
    const question = questionDrafts[advisorId];
    if (!question?.trim()) return;
    setAskingId(advisorId);
    try {
      await submitQuery(advisorId, question);
      setSentQuestion(advisorId);
      setQuestionDrafts((prev) => ({ ...prev, [advisorId]: "" }));
    } finally {
      setAskingId(null);
    }
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <p className="text-sm text-gray-500">
        Connect with a financial advisor for personalised guidance. Advisors accept connection requests
        before you can ask them questions — billing for advisory services is arranged directly with them.
      </p>

      {advisors.map((advisor) => {
        const connection = connections.find((c) => c.advisorId === advisor.id);
        return (
          <div key={advisor.id} className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{advisor.user?.name}</h3>
                  {statusBadge(connection?.status)}
                </div>
                <p className="text-sm text-gray-500">{advisor.headline}</p>
                {advisor.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {advisor.specialties.map((s) => (
                      <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!connection && (
                <button
                  onClick={() => handleConnect(advisor.id)}
                  disabled={connecting === advisor.id}
                  className="bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60 shrink-0"
                >
                  {connecting === advisor.id ? "Sending…" : "Connect"}
                </button>
              )}
            </div>

            {connection?.status === "accepted" && (
              <div className="mt-4 pt-4 border-t border-gray-50">
                {sentQuestion === advisor.id ? (
                  <p className="text-sm text-emerald-700">Question sent — you&apos;ll be notified when they reply.</p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={questionDrafts[advisor.id] ?? ""}
                      onChange={(e) => setQuestionDrafts((prev) => ({ ...prev, [advisor.id]: e.target.value }))}
                      placeholder="Ask a question…"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={() => handleAsk(advisor.id)}
                      disabled={askingId === advisor.id}
                      className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                    >
                      Ask
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  type AdvisorQueryThread,
  getQueryThread,
  answerQuery,
  replyToQuery,
} from "@/lib/advisor";

export default function QueryThread({
  queryId,
  role,
  backHref,
}: {
  queryId: string;
  role: "client" | "advisor";
  backHref: string;
}) {
  const [thread, setThread] = useState<AdvisorQueryThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  async function load() {
    setError("");
    try {
      const data = await getQueryThread(queryId);
      setThread(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      if (role === "advisor") {
        await answerQuery(queryId, draft);
      } else {
        await replyToQuery(queryId, draft);
      }
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading…</div>;
  if (!thread) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-500">{error || "Conversation not found."}</p>
        <Link href={backHref} className="text-emerald-700 font-medium hover:underline mt-4 inline-block">
          Back
        </Link>
      </div>
    );
  }

  const otherPartyName = role === "advisor" ? thread.user.name : thread.advisor.user.name;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-160px)]">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <Link href={backHref} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
          ←
        </Link>
        <div>
          <h2 className="font-bold text-gray-900">{thread.subject}</h2>
          <p className="text-sm text-gray-500">
            {role === "advisor" ? "Conversation with" : "Conversation with"} {otherPartyName}
          </p>
        </div>
        <span
          className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            thread.status === "answered" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {thread.status === "answered" ? "Answered" : "Awaiting reply"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {thread.messages.map((m) => {
          const isMine = m.senderRole === role;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                  isMine ? "bg-emerald-700 text-white" : "bg-gray-100 text-gray-900"
                }`}
              >
                <p>{m.body}</p>
                <p className={`text-xs mt-1 ${isMine ? "text-emerald-100" : "text-gray-400"}`}>
                  {new Date(m.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-100 pt-4">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Write a message…"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="self-end bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

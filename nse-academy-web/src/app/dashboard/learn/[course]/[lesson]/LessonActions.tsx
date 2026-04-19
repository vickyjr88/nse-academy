"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  lessonId: number;
  isPremium: boolean;
  prevHref: string | null;
  nextHref: string | null;
}

export default function LessonActions({ lessonId, isPremium, prevHref, nextHref }: Props) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string>("free");
  const [completed, setCompleted] = useState(false);
  const [marking, setMarking] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011";

  useEffect(() => {
    const t = localStorage.getItem("access_token");
    setToken(t);
    if (!t) return;

    // Fetch user to determine subscription tier
    fetch(`${apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.subscription?.tier) setUserTier(data.subscription.tier);
      })
      .catch(() => {});

    // Check if already completed
    fetch(`${apiUrl}/users/me/progress`, {
      headers: { Authorization: `Bearer ${t}` },
    })
      .then((r) => r.json())
      .then((data: Array<{ lessonId: string; completed: boolean }>) => {
        if (Array.isArray(data)) {
          const found = data.find((p) => p.lessonId === String(lessonId));
          if (found?.completed) setCompleted(true);
        }
      })
      .catch(() => {});
  }, [lessonId, apiUrl]);

  // Premium lock: user is not logged in or is on free tier
  if (isPremium && (!token || userTier === "free")) {
    return (
      <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-8 py-8 text-center">
        <div className="text-3xl mb-3">🔒</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Premium lesson</h3>
        <p className="text-sm text-gray-600 mb-5">
          Upgrade to NSE Academy Premium to unlock all lessons, company profiles, and
          personalised recommendations.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/pricing"
            className="bg-emerald-700 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors"
          >
            Upgrade to Premium
          </Link>
          {!token && (
            <Link
              href="/auth/login"
              className="border border-gray-300 text-gray-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    );
  }

  async function handleMarkComplete() {
    if (!token || completed) return;
    setMarking(true);
    try {
      await fetch(`${apiUrl}/users/me/progress/${lessonId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setCompleted(true);
      if (nextHref) {
        router.push(nextHref);
      }
    } catch {
      // silently ignore — progress will sync next load
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-8">
      {/* Prev */}
      <div>
        {prevHref ? (
          <Link
            href={prevHref}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Previous lesson
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Mark complete */}
      {token ? (
        <button
          onClick={handleMarkComplete}
          disabled={completed || marking}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
            completed
              ? "bg-emerald-100 text-emerald-800 cursor-default"
              : "bg-emerald-700 text-white hover:bg-emerald-800"
          }`}
        >
          {completed ? "✓ Completed" : marking ? "Saving…" : "Mark Complete"}
        </button>
      ) : (
        <Link
          href="/auth/login"
          className="text-sm text-emerald-700 hover:underline"
        >
          Log in to track progress
        </Link>
      )}

      {/* Next */}
      <div>
        {nextHref ? (
          <Link
            href={nextHref}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Next lesson →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

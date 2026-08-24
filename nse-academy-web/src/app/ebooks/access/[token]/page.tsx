"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import {
  downloadGuestEbook,
  fetchGuestAccessInfo,
  type GuestAccessInfo,
  useAccessToken,
} from "@/lib/ebook";

type State = "loading" | "ready" | "limit" | "error";

export default function GuestAccessPage() {
  const params = useParams();
  const token = params.token as string;
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState("");
  const [info, setInfo] = useState<GuestAccessInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const loggedIn = Boolean(useAccessToken());

  const email = info?.email ?? "";
  const productId = info?.productId ?? "";

  useEffect(() => {
    let cancelled = false;
    // Probe only — this must never consume one of the link's downloads.
    fetchGuestAccessInfo(token)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error);
          setState("error");
          return;
        }
        setInfo(result.info);
        setState(result.info.limitReached ? "limit" : "ready");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not reach the download service. Please try again.");
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleDownload() {
    setDownloading(true);
    setError("");
    const result = await downloadGuestEbook(token, "NSE_Academy_ebook");
    if (result.ok) {
      setInfo((prev) => ({ ...prev, ...result.info }));
      if (result.info.limitReached) setState("limit");
    } else {
      const next = result.info;
      if (next) setInfo((prev) => ({ ...prev, ...next }));
      setError(result.error);
      setState(result.limitReached ? "limit" : "error");
    }
    setDownloading(false);
  }

  const registerHref = `/auth/register?redirectTo=${encodeURIComponent(
    "/dashboard/downloads",
  )}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
  const loginHref = `/auth/login?redirectTo=${encodeURIComponent(
    "/dashboard/downloads",
  )}`;

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {state === "loading" && (
          <>
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-gray-900">Preparing your ebook…</h1>
          </>
        )}

        {state === "ready" && info && (
          <>
            <div className="text-5xl mb-6">📚</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Your ebook is ready</h1>
            <p className="text-gray-600 mb-6">
              {email
                ? `We also sent a copy to ${email}.`
                : "Download the PDF now — we also emailed it to you."}
            </p>

            <p className="inline-block text-sm font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-6">
              {info.remainingDownloads} of {info.maxDownloads} downloads remaining
              on this link
            </p>

            {error && (
              <p className="text-sm text-red-600 mb-4">{error}</p>
            )}

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-emerald-700 text-white font-bold py-4 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              {downloading ? "Preparing download…" : "Download PDF"}
            </button>

            <div className="mt-8 text-sm text-gray-500 space-y-2">
              {loggedIn ? (
                <p>
                  Downloads are unlimited in{" "}
                  <Link href="/dashboard/downloads" className="text-emerald-700 font-semibold">
                    your library
                  </Link>
                  .
                </p>
              ) : (
                <p>
                  Need more than {info.maxDownloads} downloads?{" "}
                  <Link href={registerHref} className="text-emerald-700 font-semibold">
                    Create a free account
                  </Link>{" "}
                  with this email for unlimited access.
                </p>
              )}
              {productId && (
                <p>
                  <Link href={`/ebooks/buy/${productId}`} className="hover:underline">
                    Back to the product page
                  </Link>
                </p>
              )}
            </div>
          </>
        )}

        {state === "limit" && (
          <>
            <div className="text-5xl mb-6">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Download limit reached
            </h1>
            <p className="text-gray-600 mb-8">
              {error ||
                `This link has been used for all ${info?.maxDownloads ?? 2} of its downloads. You still own this ebook — ${
                  email ? `log in with ${email}` : "log in with your purchase email"
                } to download it anytime.`}
            </p>
            {loggedIn ? (
              <Link
                href="/dashboard/downloads"
                className="inline-block w-full bg-emerald-700 text-white font-bold py-4 rounded-xl hover:bg-emerald-800"
              >
                Go to your library
              </Link>
            ) : (
              <div className="space-y-3">
                <Link
                  href={registerHref}
                  className="block w-full bg-emerald-700 text-white font-bold py-4 rounded-xl hover:bg-emerald-800"
                >
                  Create a free account
                </Link>
                <Link
                  href={loginHref}
                  className="block w-full border border-gray-300 text-gray-800 font-semibold py-4 rounded-xl hover:bg-gray-50"
                >
                  I already have an account
                </Link>
              </div>
            )}
          </>
        )}

        {state === "error" && (
          <>
            <div className="text-5xl mb-6">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Download unavailable</h1>
            <p className="text-gray-600 mb-8">{error}</p>
            <Link
              href="/store"
              className="inline-block bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl hover:bg-emerald-800"
            >
              Go to the store
            </Link>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

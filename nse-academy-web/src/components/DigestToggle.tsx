"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccessToken } from "@/lib/ebook";
import { getDigestPreference, setDigestPreference } from "@/lib/digest";

/**
 * The evening digest switch. `variant="card"` is the settings row; `variant="cta"` is the invitation under a daily
 * report, which sends a visitor who is not signed in to create an account instead.
 */
export default function DigestToggle({ variant = "card" }: { variant?: "card" | "cta" }) {
  const token = useAccessToken();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    getDigestPreference().then((v) => live && setEnabled(v)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [token]);

  async function flip(next: boolean) {
    setBusy(true);
    setFailed(false);
    try {
      setEnabled(await setDigestPreference(next));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const text = "A short email at about 21:20 on trading days: how the market closed, the biggest movers, and how your own holdings did.";

  if (variant === "cta") {
    return (
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        {!token ? (
          <Link href="/auth/register" className="inline-block rounded-xl border border-emerald-700 px-5 py-2.5 text-center text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50">
            Create a free account to get it by email
          </Link>
        ) : enabled ? (
          <p className="text-sm font-medium text-emerald-800">You will get this report by email every evening. <button type="button" onClick={() => flip(false)} disabled={busy} className="underline">Turn off</button></p>
        ) : (
          <button type="button" onClick={() => flip(true)} disabled={busy || enabled === null} className="rounded-xl border border-emerald-700 px-5 py-2.5 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60">
            Email me this every evening
          </button>
        )}
        {failed ? <span className="text-sm text-red-600">Could not save that. Please try again.</span> : null}
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Evening market digest</p>
        <p className="text-sm text-gray-600 mt-1">{text} Off until you turn it on.</p>
        {failed ? <p className="mt-2 text-sm text-red-600">Could not load or save this setting. Please try again.</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled === true}
        aria-label="Evening market digest"
        disabled={busy || enabled === null}
        onClick={() => flip(!enabled)}
        className={`shrink-0 relative h-7 w-12 rounded-full transition-colors disabled:opacity-60 ${enabled ? "bg-emerald-700" : "bg-gray-300"}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

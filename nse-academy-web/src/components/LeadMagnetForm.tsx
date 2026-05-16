"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { LeadMagnet } from "@/lib/cms";

interface Props {
  magnet: LeadMagnet;
  /** Where on the site this form is rendered — used for attribution. */
  source?: string;
  /** Optional override for the surrounding wrapper style. */
  variant?: "card" | "inline";
}

interface CaptureResponse {
  id: string;
  email: string;
  magnetSlug: string;
}

function collectUtm(): Record<string, string | undefined> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
    utmTerm: params.get("utm_term") ?? undefined,
    utmContent: params.get("utm_content") ?? undefined,
  };
}

function readReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const fromUrl = new URLSearchParams(window.location.search).get("ref");
  if (fromUrl) return fromUrl;
  return localStorage.getItem("referralCode") ?? undefined;
}

export default function LeadMagnetForm({
  magnet,
  source,
  variant = "card",
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CaptureResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const utm = collectUtm();
      const referralCode = readReferralCode();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011";
      const res = await fetch(`${apiUrl}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          magnetSlug: magnet.slug,
          source: source ?? null,
          referralCode,
          ...utm,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Something went wrong. Try again.");
      }
      const data: CaptureResponse = await res.json();
      setCaptured(data);
      trackEvent("lead_captured", {
        magnet_slug: magnet.slug,
        source,
        has_referral: Boolean(referralCode),
        has_name: Boolean(name.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!captured) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011";
    // Fire-and-forget — we don't want to block the download on the counter.
    fetch(`${apiUrl}/leads/${captured.id}/download`, { method: "POST" }).catch(
      () => {},
    );
    trackEvent("lead_magnet_downloaded", {
      magnet_slug: magnet.slug,
      source,
    });
    if (magnet.download_url) {
      window.open(magnet.download_url, "_blank", "noopener,noreferrer");
    }
  }

  const wrapper =
    variant === "card"
      ? "rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-8 sm:p-12 shadow-xl text-white"
      : "rounded-2xl border border-emerald-100 bg-white p-6 sm:p-8";

  const labelText =
    variant === "card" ? "text-emerald-100" : "text-gray-700";
  const inputClass =
    variant === "card"
      ? "w-full rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-white placeholder:text-emerald-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/50"
      : "w-full rounded-xl border border-gray-200 bg-white text-gray-900 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500";

  // -------------------- Success state --------------------

  if (captured) {
    return (
      <div className={wrapper}>
        <div className="text-3xl mb-3">📚</div>
        <h3 className="text-2xl font-bold mb-2">You&apos;re in.</h3>
        <p
          className={
            variant === "card" ? "text-emerald-100" : "text-gray-600"
          }
        >
          {magnet.success_message}
        </p>
        {magnet.download_url && (
          <button
            onClick={handleDownload}
            className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl font-bold px-6 py-3.5 transition-colors ${
              variant === "card"
                ? "bg-white text-emerald-800 hover:bg-emerald-50"
                : "bg-emerald-700 text-white hover:bg-emerald-800"
            }`}
          >
            Download the PDF →
          </button>
        )}
        <p
          className={`mt-4 text-xs ${
            variant === "card" ? "text-emerald-200" : "text-gray-400"
          }`}
        >
          Sent to <span className="font-mono">{captured.email}</span>. Check
          spam if you don&apos;t see it within a minute.
        </p>
      </div>
    );
  }

  // -------------------- Capture form --------------------

  return (
    <div className={wrapper}>
      {magnet.cover_image_url && (
        <img
          src={magnet.cover_image_url}
          alt=""
          className="mb-5 h-32 w-auto rounded-lg"
        />
      )}
      <h3 className="text-2xl font-bold mb-2">{magnet.headline}</h3>
      {magnet.description && (
        <p
          className={`mb-6 max-w-xl ${
            variant === "card" ? "text-emerald-100" : "text-gray-600"
          }`}
        >
          {magnet.description}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div>
          <label className={`text-sm font-medium ${labelText}`}>
            Your name <span className="opacity-60">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Wanjiku"
            className={inputClass}
          />
        </div>
        <div>
          <label className={`text-sm font-medium ${labelText}`}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            className={inputClass}
          />
        </div>
        {error && (
          <p
            className={`text-sm ${
              variant === "card" ? "text-amber-200" : "text-red-600"
            }`}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full font-bold px-6 py-3.5 rounded-xl transition-colors disabled:opacity-60 ${
            variant === "card"
              ? "bg-white text-emerald-800 hover:bg-emerald-50"
              : "bg-emerald-700 text-white hover:bg-emerald-800"
          }`}
        >
          {submitting ? "Sending…" : magnet.button_label}
        </button>
        <p
          className={`text-xs ${
            variant === "card" ? "text-emerald-200" : "text-gray-400"
          }`}
        >
          We&apos;ll send the PDF to your email. No spam — unsubscribe anytime.
        </p>
      </form>
    </div>
  );
}

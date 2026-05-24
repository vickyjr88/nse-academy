"use client";

import Link from "next/link";
import { TrackedLink } from "@/components/TrackedLink";

type Variant = "banner" | "card" | "inline" | "sticky";

interface UpgradePromptProps {
  variant?: Variant;
  headline: string;
  subline?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  location: string;
  highlightTier?: "intermediary" | "premium";
}

const TIER_PRICE: Record<"intermediary" | "premium", string> = {
  intermediary: "KSh 100/mo",
  premium: "KSh 500/mo",
};

export default function UpgradePrompt({
  variant = "card",
  headline,
  subline,
  ctaLabel,
  ctaHref = "/dashboard/billing",
  secondaryHref,
  secondaryLabel,
  location,
  highlightTier,
}: UpgradePromptProps) {
  const resolvedCtaLabel =
    ctaLabel ??
    (highlightTier
      ? `Upgrade to ${highlightTier === "intermediary" ? "Intermediary" : "Premium"} — ${TIER_PRICE[highlightTier]}`
      : "Upgrade now →");

  if (variant === "banner") {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-2xl px-5 py-4 shadow-sm">
        <div>
          <p className="font-semibold">{headline}</p>
          {subline && <p className="text-emerald-100 text-sm mt-0.5">{subline}</p>}
        </div>
        <TrackedLink
          href={ctaHref}
          event="upgrade_prompt_clicked"
          eventProps={{ location, variant, highlightTier }}
          className="shrink-0 bg-white text-emerald-700 font-bold px-5 py-2.5 rounded-xl hover:bg-emerald-50 transition-colors text-sm whitespace-nowrap"
        >
          {resolvedCtaLabel}
        </TrackedLink>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="my-8 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-xl px-5 py-4 flex items-start gap-4">
        <span className="text-2xl" aria-hidden>🔒</span>
        <div className="flex-1">
          <p className="font-semibold text-emerald-900">{headline}</p>
          {subline && <p className="text-sm text-emerald-700 mt-1">{subline}</p>}
          <TrackedLink
            href={ctaHref}
            event="upgrade_prompt_clicked"
            eventProps={{ location, variant, highlightTier }}
            className="inline-block mt-3 text-sm font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
          >
            {resolvedCtaLabel}
          </TrackedLink>
        </div>
      </div>
    );
  }

  if (variant === "sticky") {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40 bg-white border border-emerald-200 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <span className="text-2xl" aria-hidden>⚡</span>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">{headline}</p>
          {subline && <p className="text-xs text-gray-500 mt-0.5">{subline}</p>}
          <TrackedLink
            href={ctaHref}
            event="upgrade_prompt_clicked"
            eventProps={{ location, variant, highlightTier }}
            className="inline-block mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            {resolvedCtaLabel}
          </TrackedLink>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-700 to-emerald-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
      <h3 className="text-xl sm:text-2xl font-bold mb-2">{headline}</h3>
      {subline && <p className="text-emerald-100 mb-5">{subline}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        <TrackedLink
          href={ctaHref}
          event="upgrade_prompt_clicked"
          eventProps={{ location, variant, highlightTier }}
          className="inline-flex justify-center items-center gap-2 bg-white text-emerald-800 font-bold px-6 py-3.5 rounded-xl hover:bg-emerald-50 transition-colors text-sm shadow-md whitespace-nowrap"
        >
          {resolvedCtaLabel}
        </TrackedLink>
        {secondaryHref && secondaryLabel && (
          <Link
            href={secondaryHref}
            className="inline-flex justify-center items-center gap-2 border border-emerald-400/50 text-emerald-50 font-semibold px-6 py-3.5 rounded-xl hover:bg-emerald-700/30 transition-colors text-sm"
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TrackedLink } from "@/components/TrackedLink";
import { trackEvent } from "@/lib/analytics";
import { getPersonalization } from "@/lib/investorPersonalization";

interface PersonalizedUpgradeProps {
  investorType: string;
  source: string;
  ebookProductId?: string;
}

const STOREFRONT_URL =
  "https://dexter-api.vitaldigitalmedia.net/api/products/storefront/51fe5af0-266b-419e-8559-3f0febcd74c4";

function useResolvedEbookId(seed?: string) {
  const [id, setId] = useState<string | undefined>(seed);
  useEffect(() => {
    if (seed) return;
    let cancelled = false;
    fetch(STOREFRONT_URL)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const products: Array<{ id: string; name: string; is_digital: boolean; status: string }> =
          data?.products ?? [];
        const guide = products.find(
          (p) =>
            p.is_digital &&
            p.status === "active" &&
            /complete\s+investor/i.test(p.name)
        );
        const fallback = products.find((p) => p.is_digital && p.status === "active");
        setId(guide?.id ?? fallback?.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seed]);
  return id;
}

const TIER_LABELS: Record<"intermediary" | "premium", string> = {
  intermediary: "Intermediary",
  premium: "Premium",
};

export default function PersonalizedUpgrade({
  investorType,
  source,
  ebookProductId,
}: PersonalizedUpgradeProps) {
  const p = getPersonalization(investorType);

  useEffect(() => {
    trackEvent("personalized_upgrade_viewed", {
      investor_type: investorType,
      source,
      recommended_tier: p.recommendedTier,
    });
  }, [investorType, source, p.recommendedTier]);

  const resolvedEbookId = useResolvedEbookId(ebookProductId);
  const ebookHref = resolvedEbookId ? `/ebooks/buy/${resolvedEbookId}` : "/#ebooks";

  return (
    <div className="mt-8 space-y-6">
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
          Personalised for {p.label}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-3">
          Your next step on the NSE
        </h2>
        <p className="text-gray-600 leading-relaxed mb-6">{p.upgradeHook}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-emerald-100 p-5 relative overflow-hidden">
            <span className="absolute top-3 right-3 text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              Recommended
            </span>
            <p className="text-xs text-emerald-700 font-bold uppercase tracking-wide mb-2">
              Subscribe
            </p>
            <p className="font-bold text-gray-900 text-lg leading-snug">
              {TIER_LABELS[p.recommendedTier]} — KSh{" "}
              {p.recommendedTierPriceKes.toLocaleString("en-KE")}/mo
            </p>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              Unlock the chapters and tools matched to your {p.label.toLowerCase()} profile.
              Cancel anytime.
            </p>
            <TrackedLink
              href={`/auth/register?plan=${p.recommendedTier}`}
              event="personalized_upgrade_clicked"
              eventProps={{
                investor_type: investorType,
                source,
                action: "subscribe",
                tier: p.recommendedTier,
              }}
              className="block text-center bg-emerald-700 text-white font-bold py-3 rounded-xl hover:bg-emerald-800 transition-colors text-sm"
            >
              Start {TIER_LABELS[p.recommendedTier]} →
            </TrackedLink>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-2">
              Or own it forever
            </p>
            <p className="font-bold text-gray-900 text-lg leading-snug">
              Complete Investor&apos;s Guide — KSh 999
            </p>
            <p className="text-sm text-gray-500 mt-1 mb-4">{p.ebookAngle}</p>
            <TrackedLink
              href={ebookHref}
              event="personalized_upgrade_clicked"
              eventProps={{
                investor_type: investorType,
                source,
                action: "ebook",
              }}
              className="block text-center border border-emerald-700 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-50 transition-colors text-sm"
            >
              Buy the Complete Guide →
            </TrackedLink>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <span aria-hidden>⏰</span>
          <span>{p.urgencyAngle}</span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8">
        <h3 className="font-bold text-gray-900 text-lg mb-1">
          The 3 chapters built for {p.label.toLowerCase()}s
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          Locked content from the Complete Investor&apos;s Guide.
        </p>
        <ul className="space-y-4">
          {p.chapters.map((c) => (
            <li
              key={c.number}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
            >
              <span className="shrink-0 w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                {c.number}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-gray-900 leading-snug">{c.title}</p>
                  <span
                    aria-hidden
                    className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold"
                  >
                    🔒 Locked
                  </span>
                </div>
                <p className="text-sm text-gray-500">{c.hook}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 text-center">
          <TrackedLink
            href={`/auth/register?plan=${p.recommendedTier}`}
            event="personalized_upgrade_clicked"
            eventProps={{
              investor_type: investorType,
              source,
              action: "subscribe_from_chapters",
            }}
            className="inline-block bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors text-sm"
          >
            Unlock these chapters — KSh{" "}
            {p.recommendedTierPriceKes.toLocaleString("en-KE")}/mo
          </TrackedLink>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8">
        <h3 className="font-bold text-gray-900 text-lg mb-1">
          3 NSE counters that fit your profile
        </h3>
        <p className="text-sm text-gray-500 mb-5">
          A preview from the Stock Advisor. Full analysis, target prices, and fit
          scores are in Premium.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {p.stocks.map((s) => (
            <div
              key={s.ticker}
              className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl p-4"
            >
              <div className="flex items-baseline justify-between mb-2">
                <p className="font-mono font-bold text-emerald-700 text-lg">
                  {s.ticker}
                </p>
                <p className="text-xs text-gray-400">{s.name}</p>
              </div>
              <p className="text-sm text-gray-600 leading-snug">{s.fitReason}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/auth/register?plan=premium"
            className="inline-block text-sm font-bold text-emerald-700 hover:underline underline-offset-2"
          >
            See target prices &amp; fit scores in Premium →
          </Link>
        </div>
      </div>
    </div>
  );
}

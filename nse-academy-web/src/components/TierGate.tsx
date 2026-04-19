"use client";
import Link from "next/link";
import type { Tier } from "@/hooks/useSubscription";

const TIER_NAMES: Record<Tier, string> = {
  free: "Free",
  intermediary: "Intermediary",
  premium: "Premium",
};

const TIER_PRICES: Record<string, string> = {
  intermediary: "KSh 100/mo",
  premium: "KSh 500/mo",
};

const TIER_FEATURES: Record<string, string[]> = {
  intermediary: [
    "NSE Complete Trading Guide (7 chapters)",
    "62 NSE-listed companies deep dive",
    "Stockbroker comparison & strategies",
    "Trading Guide PDF download",
  ],
  premium: [
    "Everything in Intermediary",
    "Full 13-chapter Investor's Guide",
    "Personalized stock advisor",
    "Company research & fit analysis",
    "Investor's Guide PDF download",
  ],
};

interface TierGateProps {
  required: "intermediary" | "premium";
  currentTier: Tier;
  loading?: boolean;
  featureName?: string;
  children: React.ReactNode;
}

export function TierGate({ required, currentTier, loading, featureName, children }: TierGateProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">⏳</div>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  const tierLevel: Record<Tier, number> = { free: 0, intermediary: 1, premium: 2 };
  const hasAccess = tierLevel[currentTier] >= tierLevel[required];

  if (hasAccess) return <>{children}</>;

  const features = TIER_FEATURES[required] ?? [];

  return (
    <div className="max-w-xl mx-auto py-12">
      <div className="bg-white border border-gray-200 rounded-3xl p-10 shadow-sm text-center">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🔒</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {featureName ?? `${TIER_NAMES[required]} Feature`}
        </h2>
        <p className="text-gray-500 mb-6">
          Upgrade to <span className="font-semibold text-emerald-700">{TIER_NAMES[required]}</span> ({TIER_PRICES[required]}) to unlock this.
        </p>

        {features.length > 0 && (
          <ul className="text-left space-y-2 mb-8 bg-gray-50 rounded-2xl p-5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="text-emerald-600 shrink-0 mt-0.5">✓</span>
                {f}
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/dashboard/billing"
          className="inline-block bg-emerald-700 text-white font-bold px-8 py-4 rounded-2xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 w-full text-center"
        >
          Upgrade to {TIER_NAMES[required]} — {TIER_PRICES[required]}
        </Link>

        {currentTier === "free" && required === "premium" && (
          <p className="mt-4 text-sm text-gray-400">
            Or start with{" "}
            <Link href="/dashboard/billing" className="text-emerald-600 hover:underline font-medium">
              Intermediary at KSh 100/mo
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

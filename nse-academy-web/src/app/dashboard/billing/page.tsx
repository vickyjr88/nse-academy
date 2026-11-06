"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DurationPicker from "@/components/DurationPicker";
import type { BillingMonths } from "@/lib/pricing";

type Tier = "free" | "intermediary" | "premium";

interface Subscription {
  tier: Tier;
  status: string;
  currentPeriodEnd?: string;
}

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  intermediary: "Intermediary",
  premium: "Premium",
};

const UPGRADE_OPTIONS: { plan: "intermediary" | "premium"; label: string; price: string; features: string[] }[] = [
  {
    plan: "intermediary",
    label: "Intermediary",
    price: "KSh 300/mo",
    features: [
      "NSE Complete Trading Guide course",
      "62 NSE-listed companies deep dive",
      "Stockbroker comparison module",
      "Market indices & strategies",
      "Trade journal, portfolio tracking & price alerts",
      "Trading Guide PDF download",
    ],
  },
  {
    plan: "premium",
    label: "Premium",
    price: "KSh 500/mo",
    features: [
      "Everything in Intermediary",
      "Full 13-chapter Investor's Guide",
      "Personalized AI stock advisor",
      "Daily Portfolio Watch on your holdings",
      "Portfolio building tools",
      "Investor's Guide PDF download",
      "Priority support",
    ],
  },
];

export default function BillingPage() {
  const router = useRouter();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [initLoading, setInitLoading] = useState<BillingMonths | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<"intermediary" | "premium" | null>(null);
  const [error, setError] = useState("");
  // Fixed when the page opens: reading the clock during render would make the page impure.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent("/dashboard/billing")}`);
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSub(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(plan: "intermediary" | "premium", months: BillingMonths) {
    setInitLoading(months);
    setError("");
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan, months }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        // The API explains refusals (e.g. stepping down to a lower plan while a higher one is running).
        setError(Array.isArray(data.message) ? data.message.join(" ") : data.message || "Could not start the payment. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not start the payment. Please check your connection and try again.");
    } finally {
      setInitLoading(null);
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading billing info…</div>;

  const currentTier: Tier = sub?.tier ?? "free";
  const periodEnd = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  // A plan is "live" while it is active and has not run out; only then does buying more add to it.
  const live = sub?.status === "active" && periodEnd !== null && periodEnd.getTime() > now;
  const isPremium = currentTier === "premium" && live;
  const isIntermediary = currentTier === "intermediary" && live;
  const endLabel = periodEnd?.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((periodEnd.getTime() - now) / 86_400_000)) : 0;

  // Premium can extend Premium; Intermediary can extend itself or upgrade; everyone else can pick either plan.
  const visiblePlans = UPGRADE_OPTIONS.filter(({ plan }) => !(isPremium && plan === "intermediary"));
  const actionFor = (plan: "intermediary" | "premium") =>
    (isPremium && plan === "premium") || (isIntermediary && plan === "intermediary")
      ? "Extend"
      : isIntermediary && plan === "premium"
        ? "Upgrade to"
        : "Subscribe to";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>
        <p className="text-gray-500 mt-2">Manage your NSE Academy membership and billing.</p>
      </div>

      {/* Current plan */}
      <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm mb-8">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Current Plan</h2>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-black text-gray-900">{TIER_LABEL[currentTier]}</span>
        </div>
        {(isPremium || isIntermediary) && endLabel && (
          <p className="text-sm text-gray-500">
            Active until {endLabel} ({daysLeft} {daysLeft === 1 ? "day" : "days"} left).
          </p>
        )}
        {!isPremium && !isIntermediary && (
          <p className="text-sm text-gray-500">
            {sub?.status === "active" || !periodEnd ? "Upgrade to unlock more content and features." : `Your plan ended on ${endLabel}. Choose a plan below to get your access back.`}
          </p>
        )}
        {isPremium && (
          <div className="mt-4 flex items-center gap-2 text-emerald-700 font-semibold bg-emerald-50 py-3 px-4 rounded-xl w-fit">
            <span>✅</span> Premium Access Active
          </div>
        )}
        {isIntermediary && (
          <div className="mt-4 flex items-center gap-2 text-amber-700 font-semibold bg-amber-50 py-3 px-4 rounded-xl w-fit">
            <span>✅</span> Intermediary Access Active
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Plan options */}
      {visiblePlans.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
            {isPremium ? "Extend your plan" : isIntermediary ? "Extend or upgrade" : "Choose a plan"}
          </h2>
          {(isPremium || isIntermediary) && (
            <p className="text-sm text-gray-500 mb-4 max-w-2xl">
              Extending early adds the new time after {endLabel}, so you lose none of the days you have paid for.
              {isIntermediary && " Upgrading to Premium carries your unused Intermediary days over at their value."} Pay for 3, 6 or 12 months at once and save 5%, 10% or 15%.
            </p>
          )}
          <div className={`grid gap-6 ${visiblePlans.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-md"}`}>
            {visiblePlans.map(({ plan, label, price, features }) => (
              <div key={plan} className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xl font-bold text-gray-900">{label}</span>
                </div>
                <p className="text-2xl font-black text-emerald-700 mb-6">{price}</p>
                <ul className="space-y-3 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-emerald-600 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                {expandedPlan === plan ? (
                  <DurationPicker
                    plan={plan}
                    onSelect={(months) => handleUpgrade(plan, months)}
                    loadingMonths={initLoading}
                  />
                ) : (
                  <button
                    onClick={() => setExpandedPlan(plan)}
                    className="w-full bg-emerald-700 text-white font-bold py-4 rounded-2xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100"
                  >
                    {actionFor(plan)} {label} - {price}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

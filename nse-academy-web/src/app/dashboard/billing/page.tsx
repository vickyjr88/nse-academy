"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    price: "KSh 100/mo",
    features: [
      "NSE Complete Trading Guide course",
      "62 NSE-listed companies deep dive",
      "Stockbroker comparison module",
      "Market indices & strategies",
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
      "Personalized stock advisor",
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
  const [initLoading, setInitLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
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

  async function handleUpgrade(plan: "intermediary" | "premium") {
    setInitLoading(plan);
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to initialize payment. Please try again.");
    } finally {
      setInitLoading(null);
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading billing info…</div>;

  const currentTier: Tier = sub?.tier ?? "free";
  const isActive = sub?.status === "active";
  const isPremium = currentTier === "premium" && isActive;
  const isIntermediary = currentTier === "intermediary" && isActive;

  const visibleUpgrades = UPGRADE_OPTIONS.filter(({ plan }) => {
    if (isPremium) return false;
    if (isIntermediary) return plan === "premium";
    return true;
  });

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
          {(isPremium || isIntermediary) && (
            <span className="text-gray-400">/ Monthly</span>
          )}
        </div>
        {(isPremium || isIntermediary) && sub?.currentPeriodEnd && (
          <p className="text-sm text-gray-500">
            Active until {new Date(sub.currentPeriodEnd).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        )}
        {!isPremium && !isIntermediary && (
          <p className="text-sm text-gray-500">Upgrade to unlock more content and features.</p>
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

      {/* Upgrade options */}
      {visibleUpgrades.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
            {isIntermediary ? "Upgrade to Premium" : "Upgrade Your Plan"}
          </h2>
          <div className={`grid gap-6 ${visibleUpgrades.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-md"}`}>
            {visibleUpgrades.map(({ plan, label, price, features }) => (
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
                <button
                  onClick={() => handleUpgrade(plan)}
                  disabled={initLoading === plan}
                  className="w-full bg-emerald-700 text-white font-bold py-4 rounded-2xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  {initLoading === plan ? "Redirecting…" : `Upgrade to ${label} — ${price}`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import InvestorCard from "@/components/InvestorCard";
import { useSubscription, type Tier } from "@/hooks/useSubscription";

interface User {
  id: string;
  email: string;
  name: string;
  investorProfile?: {
    type: string;
    riskScore: number;
    horizonYears: number;
    capitalRange: string;
  } | null;
}

const TIER_CONFIG: Record<Tier, { label: string; color: string; bg: string }> = {
  free: { label: "Free", color: "text-gray-600", bg: "bg-gray-100" },
  intermediary: { label: "Intermediary", color: "text-amber-700", bg: "bg-amber-100" },
  premium: { label: "Premium", color: "text-emerald-700", bg: "bg-emerald-100" },
};

interface QuickLink {
  title: string;
  desc: string;
  href: string;
  icon: string;
  color: string;
  required?: Tier;
  locked?: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { tier, sub, loading: subLoading } = useSubscription();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.statusCode === 401) router.push("/auth/login");
        else setUser(data);
      })
      .catch(() => router.push("/auth/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const tierInfo = TIER_CONFIG[tier];
  const isActive = sub?.status === "active";

  const quickLinks: QuickLink[] = [
    {
      title: "Continue learning",
      desc: "Pick up where you left off",
      href: "/dashboard/learn",
      icon: "📚",
      color: "bg-blue-50 border-blue-100",
    },
    {
      title: "Stock Advisor",
      desc: "NSE picks matched to your profile",
      href: "/dashboard/stocks",
      icon: "📈",
      color: "bg-emerald-50 border-emerald-100",
      required: "premium",
      locked: tier !== "premium" || !isActive,
    },
    {
      title: "Company Research",
      desc: "Deep-dive investor fit analysis",
      href: "/dashboard/research",
      icon: "🔬",
      color: "bg-purple-50 border-purple-100",
      required: "premium",
      locked: tier !== "premium" || !isActive,
    },
    {
      title: "NSE Glossary",
      desc: "Look up any term instantly",
      href: "/dashboard/glossary",
      icon: "💡",
      color: "bg-yellow-50 border-yellow-100",
    },
    {
      title: "Refer Friends",
      desc: "Earn 1 free month per referral",
      href: "/dashboard/referrals",
      icon: "🎁",
      color: "bg-pink-50 border-pink-100",
    },
    {
      title: "Calculators",
      desc: "Broker fees, yield, compound growth",
      href: "/calculators",
      icon: "🧮",
      color: "bg-indigo-50 border-indigo-100",
    },
  ];

  return (
    <div className="max-w-5xl">
      {loading || subLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      ) : (
        <>
          {/* Subscription status banner */}
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 mb-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${tierInfo.bg} ${tierInfo.color}`}>
                {tierInfo.label}
              </span>
              <span className="text-sm text-gray-500">
                {tier === "free"
                  ? "Upgrade to unlock all features"
                  : isActive && sub?.currentPeriodEnd
                  ? `Active until ${new Date(sub.currentPeriodEnd).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}`
                  : "Subscription active"}
              </span>
            </div>
            {tier !== "premium" && (
              <Link
                href="/dashboard/billing"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
              >
                Upgrade →
              </Link>
            )}
          </div>

          {/* Investor profile */}
          {user?.investorProfile ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Your investor profile</h2>
                <Link href="/dashboard/profile" className="text-sm text-emerald-700 hover:underline">
                  Retake quiz
                </Link>
              </div>
              <InvestorCard
                type={user.investorProfile.type}
                riskScore={user.investorProfile.riskScore}
                horizonYears={user.investorProfile.horizonYears}
                capitalRange={user.investorProfile.capitalRange}
              />
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-emerald-900">Complete your investor profile</h2>
                <p className="text-sm text-emerald-700 mt-1">
                  Take the 10-question quiz to get your personalised learning path and stock recommendations.
                </p>
              </div>
              <Link
                href="/dashboard/profile"
                className="shrink-0 ml-6 bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors"
              >
                Start quiz →
              </Link>
            </div>
          )}

          {/* Quick links */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`relative rounded-2xl border p-5 ${card.color} hover:shadow-sm transition-shadow`}
              >
                {card.locked && (
                  <span className="absolute top-3 right-3 text-xs font-bold bg-white/80 text-gray-500 px-2 py-0.5 rounded-full border border-gray-200">
                    🔒 Premium
                  </span>
                )}
                <div className="text-2xl mb-3">{card.icon}</div>
                <h3 className="font-semibold text-gray-900">{card.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{card.desc}</p>
              </Link>
            ))}
          </div>

          {/* Upgrade nudge for free users */}
          {tier === "free" && (
            <div className="mt-8 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold mb-1">Unlock the full NSE Academy</h3>
                <p className="text-emerald-200 text-sm">
                  Stock Advisor, Company Research, Trading Guide & Investor's Guide — from KSh 100/mo.
                </p>
              </div>
              <Link
                href="/dashboard/billing"
                className="shrink-0 bg-white text-emerald-700 font-bold px-6 py-3 rounded-2xl hover:bg-emerald-50 transition-colors whitespace-nowrap"
              >
                View Plans →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

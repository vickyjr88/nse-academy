"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ReferralItem {
  id: string;
  status: "pending" | "completed";
  joinedAt: string;
  rewardedAt: string | null;
  name: string;
}

interface Stats {
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  freeMonthsEarned: number;
  referrals: ReferralItem[];
}

const SITE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://nseacademy.vitaldigitalmedia.net";

export default function ReferralsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/referrals/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [router]);

  function copyLink() {
    if (!stats) return;
    const link = `${SITE_URL}/auth/register?ref=${stats.referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function shareWhatsApp() {
    if (!stats) return;
    const link = `${SITE_URL}/auth/register?ref=${stats.referralCode}`;
    const text = encodeURIComponent(
      `Join me on NSE Academy — the best way to learn how to invest on the Nairobi Securities Exchange. Sign up free and we both get 1 month free when you subscribe! 🎁\n\n${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading referrals…</div>;

  const referralLink = stats ? `${SITE_URL}/auth/register?ref=${stats.referralCode}` : "";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">Refer Friends</h1>
        <p className="text-gray-500 mt-2">
          Share NSE Academy with friends. When they subscribe, you both get <strong className="text-emerald-700">1 month free</strong>.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { step: "1", icon: "🔗", title: "Share your link", desc: "Copy your unique referral link and send it to anyone interested in NSE investing." },
          { step: "2", icon: "👤", title: "Friend signs up", desc: "They register using your link. The referral is recorded automatically — no manual steps." },
          { step: "3", icon: "🎁", title: "Both get rewarded", desc: "When they subscribe to any paid plan, you both get 1 month of Intermediary access free." },
        ].map((s) => (
          <div key={s.step} className="bg-white border border-gray-100 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-7 h-7 bg-emerald-100 text-emerald-700 text-xs font-black rounded-full flex items-center justify-center">{s.step}</span>
              <span className="text-2xl">{s.icon}</span>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
            <p className="text-sm text-gray-500">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Referral link card */}
      <div className="bg-emerald-700 rounded-3xl p-8 mb-8 text-white">
        <p className="text-emerald-200 text-sm font-semibold uppercase tracking-wider mb-2">Your referral link</p>
        <div className="flex items-center gap-3 bg-emerald-800/50 rounded-2xl p-4 mb-5">
          <span className="text-emerald-100 text-sm font-mono flex-1 truncate">{referralLink}</span>
          <button
            onClick={copyLink}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              copied ? "bg-emerald-300 text-emerald-900" : "bg-white text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {copied ? "Copied! ✓" : "Copy"}
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={shareWhatsApp}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <span>📱</span> Share on WhatsApp
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <span>📋</span> Copy link
          </button>
        </div>
        <p className="text-emerald-200 text-xs mt-4">
          Your code: <span className="font-mono font-bold text-white">{stats?.referralCode}</span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Referred", value: stats?.totalReferrals ?? 0, icon: "👥" },
          { label: "Subscribed", value: stats?.completedReferrals ?? 0, icon: "✅" },
          { label: "Pending", value: stats?.pendingReferrals ?? 0, icon: "⏳" },
          { label: "Free Months Earned", value: stats?.freeMonthsEarned ?? 0, icon: "🎁" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-5 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-3xl font-black text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Referral history */}
      <div>
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Referral History</h2>
        {!stats?.referrals.length ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-medium text-gray-500">No referrals yet</p>
            <p className="text-sm mt-1">Share your link above to get started</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Friend</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Reward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{r.name}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(r.joinedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        r.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {r.status === "completed" ? "✓ Subscribed" : "⏳ Signed up"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {r.rewardedAt
                        ? `Rewarded ${new Date(r.rewardedAt).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`
                        : "Pending subscription"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Terms */}
      <div className="mt-8 text-xs text-gray-400 space-y-1">
        <p>• Reward is granted when the referred user makes their first paid subscription (Intermediary or Premium).</p>
        <p>• Free month is applied as a 30-day extension to your current subscription period.</p>
        <p>• There is no cap — refer as many friends as you like and earn a free month for each successful referral.</p>
        <p>• Self-referrals are not permitted. Abuse of the referral programme will result in reward forfeiture.</p>
      </div>
    </div>
  );
}

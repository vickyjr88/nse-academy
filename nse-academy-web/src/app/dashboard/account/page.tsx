"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  subscription?: { tier: string; status: string } | null;
}

interface EbookStatus {
  purchased: boolean;
  purchasedAt: string | null;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [ebook, setEbook] = useState<EbookStatus | null>(null);
  const [ebookLoading, setEbookLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([userData, ebookData]) => {
      setUser(userData);
      setEditName(userData.name ?? "");
      setEditPhone(userData.phone ?? "");
      setEbook(ebookData);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleEbookPurchase() {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setEbookLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } finally {
      setEbookLoading(false);
    }
  }

  async function handleEbookDownload() {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setDownloading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data?.url) {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = data.filename || "NSE_Complete_Investors_Guide_2026.pdf";
        a.target = "_blank";
        a.click();
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      setUser((u) => u ? { ...u, name: data.name, phone: data.phone } : u);
      setSaveMsg("Saved successfully");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">Profile Information</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Mobile Number</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value.trim())}
              placeholder="+254 7XX XXX XXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            {saveMsg && (
              <span className={`text-sm font-medium ${saveMsg.startsWith("Saved") ? "text-emerald-600" : "text-red-600"}`}>
                {saveMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Ebook */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">NSE Complete Investor's Guide 2026</h2>
          {ebook?.purchased && (
            <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Purchased</span>
          )}
        </div>
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="text-5xl shrink-0">📘</div>
          <div className="flex-1">
            <p className="text-gray-600 text-sm mb-1">
              The definitive guide to investing on the Nairobi Securities Exchange. 13 chapters, 63 company profiles, buy/hold/avoid verdicts.
            </p>
            {ebook?.purchased ? (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Purchased {ebook.purchasedAt ? new Date(ebook.purchasedAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : ""}
                </p>
                <button
                  onClick={handleEbookDownload}
                  disabled={downloading}
                  className="bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                >
                  {downloading ? "Preparing download…" : "⬇️ Download PDF"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-gray-900 mb-3">KSh 750 — one-time purchase</p>
                <button
                  onClick={handleEbookPurchase}
                  disabled={ebookLoading}
                  className="bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                >
                  {ebookLoading ? "Redirecting…" : "Buy the Ebook — KSh 750"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">Security</h2>
        </div>
        <div className="p-6">
          <button className="text-sm text-emerald-700 font-semibold hover:underline">
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
}

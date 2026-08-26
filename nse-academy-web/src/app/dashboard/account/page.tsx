"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  subscription?: { tier: string; status: string } | null;
}

function AccountPageContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [libraryCount, setLibraryCount] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      const dest = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/auth/login?redirectTo=${dest}`);
      return;
    }

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([userData, ebookData]) => {
      if (userData.statusCode === 401) {
        const dest = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/auth/login?redirectTo=${dest}`);
        return;
      }
      setUser(userData);
      setEditName(userData.name ?? "");
      setEditPhone(userData.phone ?? "");
      const purchases = ebookData?.purchases ?? [];
      const subProducts = ebookData?.subscriberAccessProducts;
      const subCount = subProducts === null ? -1 : Array.isArray(subProducts) ? subProducts.length : 0;
      setLibraryCount(subCount === -1 ? Math.max(purchases.length, 1) : purchases.length + subCount);
    }).catch(() => {
      setLoading(false);
    }).finally(() => setLoading(false));
  }, [router]);

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
              <label htmlFor="account-full-name" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                id="account-full-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="account-email" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                id="account-email"
                type="email"
                value={user?.email ?? ""}
                disabled
                className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label htmlFor="account-phone" className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Mobile Number</label>
            <input
              id="account-phone"
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700">Your downloads</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            {libraryCount
              ? "Purchased ebooks and subscription guides live in your library. We also email every PDF."
              : "Buy a guide or activate a subscription and the PDFs will show up here."}
          </p>
          <Link
            href="/dashboard/downloads"
            className="shrink-0 bg-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-800"
          >
            Open library →
          </Link>
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

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-center">Loading...</div>}>
      <AccountPageContent />
    </Suspense>
  );
}

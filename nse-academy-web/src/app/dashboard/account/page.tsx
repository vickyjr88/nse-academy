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

interface Purchase {
  productId: string;
  purchasedAt: string;
}

interface DexterProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  thumbnail: string | null;
  description: string;
  category: string;
  is_digital: boolean;
  status: string;
}

const STOREFRONT_URL =
  "https://dexter-api.vitaldigitalmedia.net/api/products/storefront/51fe5af0-266b-419e-8559-3f0febcd74c4";

function AccountPageContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  /** null = all products (premium), string[] = specific IDs (intermediary), undefined = none (free) */
  const [subscriberAccessProducts, setSubscriberAccessProducts] = useState<string[] | null | undefined>(undefined);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [dexterProducts, setDexterProducts] = useState<DexterProduct[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      fetch(STOREFRONT_URL).then(r => r.json()).catch(() => ({ products: [] })),
    ]).then(([userData, ebookData, storefrontData]) => {
      if (userData.statusCode === 401) {
        const dest = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/auth/login?redirectTo=${dest}`);
        return;
      }
      setUser(userData);
      setEditName(userData.name ?? "");
      setEditPhone(userData.phone ?? "");
      setPurchases(ebookData?.purchases ?? []);
      setSubscriberAccessProducts(ebookData?.subscriberAccessProducts);
      setSubscriptionTier(ebookData?.subscriptionTier ?? "free");
      const digital = (storefrontData?.products ?? []).filter(
        (p: DexterProduct) => p.is_digital && p.status === "active",
      );
      setDexterProducts(digital);
    }).catch(() => {
      setLoading(false);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleDownload(productId: string, name: string) {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    setDownloadingId(productId);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/ebook/download/${encodeURIComponent(productId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingId(null);
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

  // Helper: check if subscriber access covers a specific product
  function hasSubAccess(productId: string): boolean {
    if (subscriberAccessProducts === null) return true;  // premium = all
    if (Array.isArray(subscriberAccessProducts)) return subscriberAccessProducts.includes(productId);
    return false; // undefined = free tier, no access
  }

  const hasAnySub = subscriberAccessProducts !== undefined;

  // Determine which ebooks the user can download:
  // - Purchased ebooks (always downloadable)
  // - Ebooks covered by subscription tier
  const downloadableProducts = dexterProducts.filter(p =>
    purchases.some(pur => pur.productId === p.id) || hasSubAccess(p.id)
  );

  const purchasableProducts = dexterProducts.filter(p =>
    !purchases.some(pur => pur.productId === p.id) && !hasSubAccess(p.id)
  );

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

      {/* Ebooks Section */}
      {dexterProducts.length > 0 && (
        <div className="space-y-6">
          {/* Subscriber banner */}
          {hasAnySub && (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl px-6 py-4 flex items-center gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <p className="font-bold text-emerald-800 text-sm">
                  {subscriberAccessProducts === null
                    ? <>All ebooks included with your <span className="capitalize">{subscriptionTier}</span> subscription</>
                    : <>Trading Guide included with your <span className="capitalize">{subscriptionTier}</span> subscription</>}
                </p>
                <p className="text-xs text-emerald-600">
                  {subscriberAccessProducts === null
                    ? "Download any guide below — no extra charge."
                    : "Upgrade to Premium for access to all guides."}
                </p>
              </div>
            </div>
          )}

          {/* Downloadable Ebooks (Your Library) */}
          {downloadableProducts.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-50 bg-emerald-50/30 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your Library</h2>
                  <p className="text-xs text-gray-500">
                    {subscriberAccessProducts === null
                      ? "All guides available with your subscription."
                      : purchases.length > 0
                        ? "Your purchased and subscription guides."
                        : "Guides included with your subscription."}
                  </p>
                </div>
                <span className="text-2xl">📚</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {downloadableProducts.map(product => {
                  const purchase = purchases.find(p => p.productId === product.id);
                  const isDownloading = downloadingId === product.id;
                  return (
                    <div key={product.id} className="flex gap-4 p-4 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors bg-gray-50/30">
                      {product.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.thumbnail} alt={product.name} className="w-20 h-20 object-cover rounded-xl shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 bg-emerald-100 rounded-xl flex items-center justify-center text-3xl shrink-0">📘</div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-gray-900 text-sm leading-tight mb-1">{product.name}</p>
                          {purchase ? (
                            <p className="text-[10px] text-gray-400">Purchased {new Date(purchase.purchasedAt).toLocaleDateString("en-KE")}</p>
                          ) : hasSubAccess(product.id) ? (
                            <p className="text-[10px] text-emerald-600 font-medium">Included with subscription</p>
                          ) : null}
                        </div>
                        <button
                          onClick={() => handleDownload(product.id, product.name)}
                          disabled={isDownloading}
                          className="mt-3 w-full bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isDownloading ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Preparing…
                            </>
                          ) : (
                            <><span>⬇️</span> Download PDF</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available Ebooks (not yet purchased, and not a subscriber) */}
          {purchasableProducts.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-50">
                <h2 className="text-lg font-bold text-gray-900">Investment Guides</h2>
                <p className="text-xs text-gray-500">Accelerate your learning with our comprehensive NSE guides.</p>
              </div>
              <div className="divide-y divide-gray-50">
                {purchasableProducts.map(product => (
                  <div key={product.id} className="p-6 flex flex-col sm:flex-row items-center gap-6">
                    {product.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.thumbnail} alt={product.name} className="w-24 h-24 object-cover rounded-xl shrink-0 border border-gray-100" />
                    ) : (
                      <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center text-4xl shrink-0">📖</div>
                    )}
                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <h3 className="font-bold text-gray-900">{product.name}</h3>
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-lg font-black text-emerald-700">KSh {product.price.toLocaleString("en-KE")}</span>
                          {product.compare_at_price && (
                            <span className="text-sm text-gray-400 line-through">KSh {product.compare_at_price.toLocaleString("en-KE")}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                      <Link
                        href={`/ebooks/buy/${product.id}`}
                        className="inline-block w-full sm:w-auto bg-emerald-700 text-white text-sm font-bold px-8 py-3 rounded-xl hover:bg-emerald-800 transition-all shadow-md shadow-emerald-100 text-center"
                      >
                        Buy Now →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All owned message */}
          {purchasableProducts.length === 0 && downloadableProducts.length > 0 && !hasAnySub && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
              <p className="text-lg font-medium text-gray-400">You own all available guides! 🚀</p>
              <p className="text-sm text-gray-400">Check your library above to download them.</p>
            </div>
          )}
        </div>
      )}

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

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dexterProducts, setDexterProducts] = useState<DexterProduct[]>([]);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(STOREFRONT_URL).then(r => r.json()).catch(() => ({ products: [] })),
    ]).then(([userData, ebookData, storefrontData]) => {
      setUser(userData);
      setEditName(userData.name ?? "");
      setEditPhone(userData.phone ?? "");
      setPurchases(ebookData?.purchases ?? []);
      const digital = (storefrontData?.products ?? []).filter(
        (p: DexterProduct) => p.is_digital && p.status === "active",
      );
      setDexterProducts(digital);
    }).finally(() => setLoading(false));
  }, [router]);

  // Auto-trigger purchase when landing page passes ?buyEbook=productId
  useEffect(() => {
    const buyProductId = searchParams.get("buyEbook");
    if (!buyProductId || !user || dexterProducts.length === 0) return;
    const product = dexterProducts.find(p => p.id === buyProductId);
    if (!product) return;
    if (purchases.some(p => p.productId === buyProductId)) return;
    handlePurchase(buyProductId, product.price);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dexterProducts, searchParams]);

  async function handlePurchase(productId: string, priceKes: number) {
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }
    setPurchasingId(productId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, priceKes }),
      });
      const data = await res.json();
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } finally {
      setPurchasingId(null);
    }
  }

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

      {/* Ebooks */}
      {dexterProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-700">NSE Investment Guides</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {dexterProducts.map(product => {
              const purchase = purchases.find(p => p.productId === product.id);
              const isOwned = !!purchase;
              const isPurchasing = purchasingId === product.id;
              const isDownloading = downloadingId === product.id;
              return (
                <div key={product.id} className="p-6 flex flex-col sm:flex-row items-start gap-5">
                  {product.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.thumbnail}
                      alt={product.name}
                      className="w-24 h-24 object-cover rounded-xl shrink-0 border border-gray-100"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-emerald-50 rounded-xl flex items-center justify-center text-4xl shrink-0">📘</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-snug mb-1">{product.name}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
                      </div>
                      {isOwned && (
                        <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">Owned</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                      <div className="flex items-baseline gap-2">
                        {isOwned ? (
                          <span className="text-xs text-gray-400">
                            Purchased {new Date(purchase!.purchasedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                          </span>
                        ) : (
                          <>
                            <span className="text-base font-bold text-gray-900">
                              KSh {product.price.toLocaleString("en-KE")}
                            </span>
                            {product.compare_at_price && (
                              <span className="text-sm text-gray-400 line-through">
                                KSh {product.compare_at_price.toLocaleString("en-KE")}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {isOwned ? (
                        <button
                          onClick={() => handleDownload(product.id, product.name)}
                          disabled={isDownloading}
                          className="bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                        >
                          {isDownloading ? "Preparing…" : "⬇️ Download PDF"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(product.id, product.price)}
                          disabled={isPurchasing}
                          className="bg-emerald-700 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                        >
                          {isPurchasing ? "Redirecting…" : `Buy — KSh ${product.price.toLocaleString("en-KE")}`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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

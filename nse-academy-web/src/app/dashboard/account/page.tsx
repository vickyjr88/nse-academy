"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getDigitalProducts, type DexterProduct } from "@/lib/dexter";

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

interface Props {
  initialProducts: DexterProduct[];
}

function AccountPageContent({ initialProducts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [dexterProducts] = useState<DexterProduct[]>(initialProducts);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState("");

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
      setPurchases(ebookData?.purchases ?? []);
    }).catch(() => {
      // If everything fails, maybe we're offline or API is down
      setLoading(false);
    }).finally(() => setLoading(false));
  }, [router]);

  // Auto-trigger purchase when landing page passes ?buyEbook=productId
  useEffect(() => {
    const buyProductId = searchParams.get("buyEbook");
    if (!buyProductId || !user?.id || dexterProducts.length === 0 || purchasingId) return;
    
    // Check if already owned
    if (purchases.some(p => p.productId === buyProductId)) {
      setPurchaseError("You already own this ebook. Check your library below!");
      return;
    }

    const product = dexterProducts.find(p => p.id === buyProductId);
    if (!product) {
      setPurchaseError("The requested ebook could not be found.");
      return;
    }
    
    handlePurchase(buyProductId, product.price);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dexterProducts, searchParams, purchases]);

  async function handlePurchase(productId: string, priceKes: number) {
    const token = localStorage.getItem("access_token");
    if (!token) {
      const dest = encodeURIComponent(window.location.pathname + window.location.search);
      router.push(`/auth/login?redirectTo=${dest}`);
      return;
    }
    setPurchasingId(productId);
    setPurchaseError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId, priceKes }),
      });
      const data = await res.json();
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setPurchaseError(data?.message || "Failed to initialize payment.");
      }
    } catch (err) {
      setPurchaseError("Connection error. Please check your internet and try again.");
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
      
      {/* Purchase Status Alert */}
      {purchaseError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p>{purchaseError}</p>
          </div>
          <button onClick={() => setPurchaseError("")} className="text-red-400 hover:text-red-600 transition-colors">✕</button>
        </div>
      )}

      {purchasingId && searchParams.get("buyEbook") === purchasingId && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-6 py-4 rounded-2xl text-sm flex items-center gap-3 animate-pulse">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="font-medium">Initializing your ebook purchase… You will be redirected to Paystack shortly.</p>
        </div>
      )}

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
          {/* Owned Ebooks (Your Library) */}
          {purchases.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-50 bg-emerald-50/30 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your Library</h2>
                  <p className="text-xs text-gray-500">Guides you&apos;ve purchased for your investment journey.</p>
                </div>
                <span className="text-2xl">📚</span>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {dexterProducts.filter(p => purchases.some(pur => pur.productId === p.id)).map(product => {
                  const purchase = purchases.find(p => p.productId === product.id)!;
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
                          <p className="text-[10px] text-gray-400">Purchased {new Date(purchase.purchasedAt).toLocaleDateString("en-KE")}</p>
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

          {/* Available Ebooks (Marketplace) */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-50">
              <h2 className="text-lg font-bold text-gray-900">Investment Guides</h2>
              <p className="text-xs text-gray-500">Accelerate your learning with our comprehensive NSE guides.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {dexterProducts.filter(p => !purchases.some(pur => pur.productId === p.id)).map(product => {
                const isPurchasing = purchasingId === product.id;
                return (
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
                      <button
                        onClick={() => handlePurchase(product.id, product.price)}
                        disabled={isPurchasing}
                        className="w-full sm:w-auto bg-emerald-700 text-white text-sm font-bold px-8 py-3 rounded-xl hover:bg-emerald-800 transition-all shadow-md shadow-emerald-100 disabled:opacity-60"
                      >
                        {isPurchasing ? "Redirecting to Paystack…" : "Buy Now →"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {dexterProducts.filter(p => !purchases.some(pur => pur.productId === p.id)).length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  <p className="text-lg font-medium">You own all available guides! 🚀</p>
                  <p className="text-sm">Check your library above to download them.</p>
                </div>
              )}
            </div>
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

export default async function AccountPage() {
  const products = await getDigitalProducts();
  
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-center">Loading...</div>}>
      <AccountPageContent initialProducts={products} />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

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

interface EbookStatus {
  purchases: { productId: string; purchasedAt: string }[];
  /** null = all products (premium), string[] = specific IDs (intermediary), absent/undefined = none (free) */
  subscriberAccessProducts: string[] | null;
  subscriptionTier: string;
}

const STOREFRONT_URL =
  "https://dexter-api.vitaldigitalmedia.net/api/products/storefront/51fe5af0-266b-419e-8559-3f0febcd74c4";

export default function EbookBuyPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<DexterProduct | null>(null);
  const [allProducts, setAllProducts] = useState<DexterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Auth + ebook status
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [ebookStatus, setEbookStatus] = useState<EbookStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Purchase flow
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  // Download flow
  const [downloading, setDownloading] = useState(false);

  // Load product data
  useEffect(() => {
    fetch(STOREFRONT_URL)
      .then((r) => r.json())
      .then((data) => {
        const products: DexterProduct[] = (data?.products ?? []).filter(
          (p: DexterProduct) => p.is_digital && p.status === "active"
        );
        setAllProducts(products);
        const found = products.find((p) => p.id === productId);
        if (found) {
          setProduct(found);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [productId]);

  // Check auth + ebook status
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoggedIn(false);
      setStatusLoading(false);
      return;
    }
    setIsLoggedIn(true);

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          setIsLoggedIn(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setEbookStatus(data);
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  const alreadyOwned = ebookStatus?.purchases?.some(
    (p) => p.productId === productId
  );
  // null = all products accessible (premium), string[] = check if this product is in list
  const subProducts = ebookStatus?.subscriberAccessProducts;
  const hasSubscriberAccess = subProducts === null
    ? true
    : Array.isArray(subProducts) && subProducts.includes(productId);
  const canDownloadFree = alreadyOwned || hasSubscriberAccess;

  async function handlePurchase() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      // Redirect to login, come back here after
      const returnUrl = `/ebooks/buy/${productId}`;
      router.push(
        `/auth/login?redirectTo=${encodeURIComponent(returnUrl)}`
      );
      return;
    }
    if (!product) return;

    setPurchasing(true);
    setPurchaseError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/ebook/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: product.id,
            priceKes: product.price,
          }),
        }
      );
      const data = await res.json();
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setPurchaseError(
          data?.message || "Failed to initialize payment. Please try again."
        );
      }
    } catch {
      setPurchaseError(
        "Connection error. Please check your internet and try again."
      );
    } finally {
      setPurchasing(false);
    }
  }

  async function handleDownload() {
    const token = localStorage.getItem("access_token");
    if (!token || !product) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/ebook/download/${encodeURIComponent(product.id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${product.name.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPurchaseError("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <div className="flex items-center justify-center py-32">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
        <PublicFooter />
      </div>
    );
  }

  // --- Not found ---
  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="text-5xl mb-6">📭</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Ebook not found
          </h1>
          <p className="text-gray-500 mb-6">
            This product may no longer be available.
          </p>
          <Link
            href="/"
            className="bg-emerald-700 text-white px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors font-semibold"
          >
            Back to Home
          </Link>
        </div>
        <PublicFooter />
      </div>
    );
  }

  // --- Determine CTA ---
  let ctaElement: React.ReactNode;

  if (statusLoading) {
    ctaElement = (
      <div className="flex items-center justify-center gap-2 text-gray-400 py-3">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Checking access…
      </div>
    );
  } else if (canDownloadFree) {
    ctaElement = (
      <div className="space-y-3">
        {hasSubscriberAccess && !alreadyOwned && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
            <span>✅</span>
            <span>
              Included with your{" "}
              <span className="capitalize font-bold">
                {ebookStatus?.subscriptionTier}
              </span>{" "}
              subscription — download free!
            </span>
          </div>
        )}
        {alreadyOwned && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
            <span>📚</span>
            <span>You already own this ebook!</span>
          </div>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full bg-emerald-700 text-white text-base font-bold py-4 rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Preparing download…
            </>
          ) : (
            <>
              <span>⬇️</span> Download PDF — Free
            </>
          )}
        </button>
      </div>
    );
  } else if (isLoggedIn) {
    ctaElement = (
      <button
        onClick={handlePurchase}
        disabled={purchasing}
        className="w-full bg-emerald-700 text-white text-base font-bold py-4 rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {purchasing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Redirecting to Paystack…
          </>
        ) : (
          <>
            Buy Now — KSh {product.price.toLocaleString("en-KE")} →
          </>
        )}
      </button>
    );
  } else {
    // Not logged in — two options
    ctaElement = (
      <div className="space-y-3">
        <button
          onClick={handlePurchase}
          className="w-full bg-emerald-700 text-white text-base font-bold py-4 rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
        >
          Buy Now — KSh {product.price.toLocaleString("en-KE")} →
        </button>
        <p className="text-xs text-gray-400 text-center">
          You&apos;ll be asked to log in or create a free account first.
        </p>
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-wider">or</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 text-center">
          <p className="text-sm text-emerald-800 font-medium mb-1">
            🎓 Subscribe &amp; get ebooks included
          </p>
          <p className="text-xs text-emerald-600 mb-3">
            Intermediary (KSh 100/mo) includes the Trading Guide. Premium (KSh 500/mo) includes all ebooks.
          </p>
          <Link
            href="/auth/register?plan=intermediary"
            className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-900 underline underline-offset-2"
          >
            Get started from KSh 100/mo →
          </Link>
        </div>
      </div>
    );
  }

  // Other ebooks for cross-sell
  const otherProducts = allProducts.filter((p) => p.id !== productId);

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span className="text-gray-700">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left column — Product details */}
          <div className="lg:col-span-3 space-y-6">
            {product.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnail}
                alt={product.name}
                className="w-full max-h-[400px] object-cover rounded-2xl border border-gray-100 shadow-sm"
              />
            )}
            <div>
              <span className="inline-block text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full mb-3">
                {product.category}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
                {product.name}
              </h1>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Features list */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">What&apos;s inside</h3>
              <ul className="space-y-3">
                {[
                  "Complete NSE investing framework",
                  "Step-by-step stock analysis methodology",
                  "Risk management strategies",
                  "Real case studies from NSE-listed companies",
                  "Downloadable PDF — read anytime, anywhere",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <span className="text-emerald-600 shrink-0 mt-0.5">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right column — Purchase card */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-3xl font-black text-gray-900">
                    KSh {product.price.toLocaleString("en-KE")}
                  </span>
                  {product.compare_at_price && (
                    <span className="text-lg text-gray-400 line-through">
                      KSh {product.compare_at_price.toLocaleString("en-KE")}
                    </span>
                  )}
                </div>
                {product.compare_at_price && (
                  <span className="inline-block text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    Save KSh{" "}
                    {(product.compare_at_price - product.price).toLocaleString(
                      "en-KE"
                    )}
                  </span>
                )}
              </div>

              <div className="p-6 space-y-4">
                {ctaElement}

                {purchaseError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {purchaseError}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>🔒</span>
                    <span>Secure payment via Paystack (M-Pesa, Card, Bank)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>📱</span>
                    <span>Instant PDF download after purchase</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>♾️</span>
                    <span>Lifetime access — download anytime</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-sell other ebooks */}
        {otherProducts.length > 0 && (
          <section className="mt-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              More Investment Guides
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {otherProducts.map((book) => (
                <Link
                  key={book.id}
                  href={`/ebooks/buy/${book.id}`}
                  className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-emerald-200 hover:shadow-md transition-all flex flex-col"
                >
                  {book.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.thumbnail}
                      alt={book.name}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors mb-2">
                      {book.name}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">
                      {book.description}
                    </p>
                    <span className="text-lg font-bold text-emerald-700">
                      KSh {book.price.toLocaleString("en-KE")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

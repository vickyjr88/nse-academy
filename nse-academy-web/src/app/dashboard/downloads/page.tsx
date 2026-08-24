"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  STOREFRONT_URL,
  downloadOwnedEbook,
  getAccessToken,
  hasSubscriberAccess,
  type DexterProduct,
  type EbookStatus,
} from "@/lib/ebook";

export default function DownloadsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<EbookStatus | null>(null);
  const [products, setProducts] = useState<DexterProduct[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Validated getter: an expired token routes to login rather than
    // rendering an empty library against a rejected request.
    const token = getAccessToken();
    if (!token) {
      router.push(
        `/auth/login?redirectTo=${encodeURIComponent("/dashboard/downloads")}`,
      );
      return;
    }

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/ebook/status`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json()),
      fetch(STOREFRONT_URL)
        .then((r) => r.json())
        .catch(() => ({ products: [] })),
    ])
      .then(([ebookData, storefrontData]) => {
        if (ebookData?.statusCode === 401) {
          router.push(
            `/auth/login?redirectTo=${encodeURIComponent("/dashboard/downloads")}`,
          );
          return;
        }
        setStatus(ebookData);
        const digital = ((storefrontData?.products ?? []) as DexterProduct[]).filter(
          (p) => p.is_digital && p.status === "active",
        );
        setProducts(digital);
      })
      .catch(() => setError("Could not load your library."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleDownload(product: DexterProduct) {
    setDownloadingId(product.id);
    setError("");
    const result = await downloadOwnedEbook(product.id, product.name);
    if (!result.ok) setError(result.error);
    setDownloadingId(null);
  }

  if (loading) {
    return <div className="p-8 text-gray-400 text-center">Loading your library…</div>;
  }

  const purchases = status?.purchases ?? [];
  const downloadable = products.filter(
    (p) =>
      purchases.some((pur) => pur.productId === p.id) ||
      hasSubscriberAccess(status?.subscriberAccessProducts, p.id),
  );
  const purchasable = products.filter(
    (p) =>
      !purchases.some((pur) => pur.productId === p.id) &&
      !hasSubscriberAccess(status?.subscriberAccessProducts, p.id),
  );

  const paidSub =
    Boolean(status?.subscriptionActive) && status?.subscriptionTier !== "free";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Downloads</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ebooks you bought and guides included with your subscription. We also email every purchase.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {paidSub && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl px-6 py-4">
          <p className="font-bold text-emerald-800 text-sm">
            {status?.subscriberAccessProducts === null
              ? `All ebooks included with your ${status?.subscriptionTier} subscription`
              : `Trading Guide included with your ${status?.subscriptionTier} subscription`}
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            {status?.subscriberAccessProducts === null
              ? "Download any guide below — no extra charge."
              : "Upgrade to Premium for every guide."}
          </p>
        </div>
      )}

      {downloadable.length > 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-50 bg-emerald-50/30">
            <h2 className="text-lg font-bold text-gray-900">Your library</h2>
            <p className="text-xs text-gray-500">Click download — the PDF also lives in your inbox.</p>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {downloadable.map((product) => {
              const purchase = purchases.find((p) => p.productId === product.id);
              const isDownloading = downloadingId === product.id;
              return (
                <div
                  key={product.id}
                  className="flex gap-4 p-4 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors bg-gray-50/30"
                >
                  {product.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.thumbnail}
                      alt={product.name}
                      className="w-20 h-20 object-cover rounded-xl shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-emerald-100 rounded-xl flex items-center justify-center text-3xl shrink-0">
                      📘
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-sm leading-tight mb-1">
                        {product.name}
                      </p>
                      {purchase ? (
                        <p className="text-[10px] text-gray-400">
                          Purchased {new Date(purchase.purchasedAt).toLocaleDateString("en-KE")}
                        </p>
                      ) : (
                        <p className="text-[10px] text-emerald-600 font-medium">
                          Included with subscription
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownload(product)}
                      disabled={isDownloading}
                      className="mt-3 w-full bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg hover:bg-emerald-800 transition-all disabled:opacity-60"
                    >
                      {isDownloading ? "Preparing…" : "Download PDF"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-lg font-medium text-gray-700">No downloads yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            Buy a guide as a guest or with your account — it will show up here after you log in.
          </p>
          <Link
            href="/store"
            className="inline-block bg-emerald-700 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-emerald-800"
          >
            Browse the store
          </Link>
        </div>
      )}

      {purchasable.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-gray-50">
            <h2 className="text-lg font-bold text-gray-900">Get more guides</h2>
            <p className="text-xs text-gray-500">One-time purchase or unlock with a subscription at checkout.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {purchasable.map((product) => (
              <div
                key={product.id}
                className="p-6 flex flex-col sm:flex-row items-center gap-6"
              >
                {product.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.thumbnail}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded-xl shrink-0 border border-gray-100"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center text-4xl shrink-0">
                    📖
                  </div>
                )}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900">{product.name}</h3>
                    <span className="text-lg font-black text-emerald-700">
                      KSh {product.price.toLocaleString("en-KE")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                  <Link
                    href={`/ebooks/buy/${product.id}`}
                    className="inline-block w-full sm:w-auto bg-emerald-700 text-white text-sm font-bold px-8 py-3 rounded-xl hover:bg-emerald-800 text-center"
                  >
                    Go to checkout →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

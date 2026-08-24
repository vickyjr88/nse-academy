"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import CheckoutPanel from "@/components/checkout/CheckoutPanel";
import { STOREFRONT_URL, type DexterProduct } from "@/lib/ebook";

function ProductJsonLd({ product }: { product: DexterProduct | null }) {
  if (!product) return null;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net');
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.thumbnail,
    "offers": {
      "@type": "Offer",
      "priceCurrency": "KES",
      "price": product.price,
      "availability": "https://schema.org/InStock",
      "url": `${siteUrl}/ebooks/buy/${product.id}`
    }
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function EbookBuyPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<DexterProduct | null>(null);
  const [allProducts, setAllProducts] = useState<DexterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  const otherProducts = allProducts.filter((p) => p.id !== productId);

  return (
    <>
    <ProductJsonLd product={product} />
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-400">
          <Link href="/" className="hover:text-gray-600 transition-colors">
            Home
          </Link>
          <span className="mx-2">›</span>
          <Link href="/store" className="hover:text-gray-600 transition-colors">
            Store
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
                <CheckoutPanel product={product} />

                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>🔒</span>
                    <span>Secure payment via Paystack (M-Pesa, Card, Bank)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>📱</span>
                    <span>Instant PDF download + email after purchase</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>👤</span>
                    <span>Guest checkout — no account required</span>
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
    </>
  );
}

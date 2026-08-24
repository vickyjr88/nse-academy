import Link from "next/link";
import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getDigitalProducts } from "@/lib/dexter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NSE Investment Store — NSE Academy",
  description:
    "Comprehensive guides and ebooks to help you master the Nairobi Securities Exchange. Start building your portfolio today.",
};

export default async function StorePage() {
  const ebooks = await getDigitalProducts();

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
            🛒 NSE Academy Store
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Investment Guides & Ebooks</h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            Master the Nairobi Securities Exchange with our expert-curated guides. From fundamental analysis to portfolio management.
          </p>
        </div>

        {ebooks.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-5xl mb-4">📖</div>
            <p className="text-lg font-medium">Coming soon.</p>
            <p className="text-sm mt-1">
              We are currently preparing more comprehensive guides for you.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ebooks.map((book) => (
              <div
                key={book.id}
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all hover:-translate-y-1"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {book.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={book.thumbnail}
                      alt={book.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center text-5xl">
                      📘
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm uppercase tracking-wider">
                      {book.category}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-bold text-gray-900 text-xl leading-snug mb-3 group-hover:text-emerald-700 transition-colors">
                    {book.name}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-6 flex-1">
                    {book.description}
                  </p>
                  
                  <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400 uppercase font-bold tracking-tight">Price</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-gray-900">
                          KSh {book.price.toLocaleString("en-KE")}
                        </span>
                        {book.compare_at_price && (
                          <span className="text-sm text-gray-400 line-through">
                            KSh {book.compare_at_price.toLocaleString("en-KE")}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Link
                      href={`/ebooks/buy/${book.id}`}
                      className="bg-emerald-700 text-white text-sm font-bold px-6 py-3 rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                    >
                      Buy Now
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Why our guides? */}
        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { icon: "🎓", title: "Expert Curated", text: "Written by NSE veterans with decades of experience in Kenyan capital markets." },
            { icon: "📱", title: "Mobile Ready", text: "Downloadable PDF format that reads beautifully on any device — phone, tablet, or laptop." },
            { icon: "♻️", title: "Free Updates", text: "Buy once and get free lifetime updates as market regulations and data change." }
          ].map(f => (
            <div key={f.title} className="text-center">
              <div className="text-4xl mb-4">{f.icon}</div>
              <h4 className="font-bold text-gray-900 mb-2">{f.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-32 bg-gray-50 rounded-[3rem] p-8 sm:p-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl mx-auto">
            {[
              { q: "How do I receive my ebook?", a: "Pay as a guest or while logged in. After Paystack confirms, you can download immediately, we email the PDF to you, and signed-in buyers also find it under My Downloads." },
              { q: "What payment methods are accepted?", a: "We accept M-Pesa, Card (Visa/Mastercard), and Bank Transfers through our secure Paystack integration." },
              { q: "Are these guides suitable for beginners?", a: "Yes, our guides are categorized by experience level. Look for 'Starter' or 'Basics' for absolute beginners." },
              { q: "Can I print the guide?", a: "Absolutely! The PDF format is high-resolution and optimized for both screen reading and printing." }
            ].map(faq => (
              <div key={faq.q}>
                <h4 className="font-bold text-gray-900 mb-2">Q: {faq.q}</h4>
                <p className="text-sm text-gray-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

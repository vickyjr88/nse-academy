import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { fmtPct, fmtPrice } from "@/lib/market-report";
import { getResearchNote } from "@/lib/research";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const n = await getResearchNote(slug);
  if (!n) return { title: "Research note not found - NSE Academy" };
  return { title: `${n.title} - NSE Academy`, description: n.summary, alternates: { canonical: `/research/${n.slug}` } };
}

const kes = (n: number) => (n >= 1e9 ? `KSh ${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `KSh ${(n / 1e6).toFixed(1)}M` : `KSh ${Math.round(n).toLocaleString("en-KE")}`);
const tone = (n: number | null) => (n == null || n === 0 ? "text-gray-600" : n > 0 ? "text-emerald-700" : "text-red-600");

export default async function ResearchNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = await getResearchNote(slug);
  if (!n) notFound();
  const stocks = n.facts.stocks ?? [];
  const paragraphs = n.body.split(/\n{2,}/);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500"><Link href="/research" className="hover:text-emerald-700">Research</Link></nav>
        <h1 className="mb-3 text-3xl font-bold text-gray-900">{n.title}</h1>
        <p className="mb-2 text-sm text-gray-500">
          Reviewed by {n.reviewedBy}
          {n.publishedAt ? <> &middot; published {new Date(n.publishedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}</> : null}
          {n.facts.asOf ? <> &middot; prices as of {n.facts.asOf}</> : null}
        </p>

        <article className="mt-8 space-y-5 leading-relaxed text-gray-800">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">{p}</p>
          ))}
        </article>

        {stocks.length > 0 ? (
          <section className="mt-10 rounded-3xl border border-gray-100 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">The numbers</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-semibold">Stock</th>
                    <th className="py-2 pr-3 text-right font-semibold">Close</th>
                    <th className="py-2 pr-3 text-right font-semibold">1 month</th>
                    <th className="py-2 pr-3 text-right font-semibold">3 months</th>
                    <th className="py-2 pr-3 text-right font-semibold">From 60-day high</th>
                    <th className="py-2 pr-3 text-right font-semibold">Daily swing</th>
                    <th className="py-2 text-right font-semibold">Traded a day</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((s) => (
                    <tr key={s.ticker} className="border-b border-gray-100 last:border-0">
                      <td className="py-2.5 pr-3 font-semibold text-gray-900"><Link href={`/companies/${s.ticker}`} className="hover:text-emerald-700">{s.ticker}</Link></td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPrice(s.price)}</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums ${tone(s.ret1mPct)}`}>{s.ret1mPct != null ? fmtPct(s.ret1mPct) : "-"}</td>
                      <td className={`py-2.5 pr-3 text-right tabular-nums ${tone(s.ret3mPct)}`}>{s.ret3mPct != null ? fmtPct(s.ret3mPct) : "-"}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{s.fromHighPct.toFixed(1)}%</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{s.volatilityPct.toFixed(2)}%</td>
                      <td className="py-2.5 text-right tabular-nums">{kes(s.avgDailyValueKes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">Computed from NSE closing prices and trading values. Daily swing is the typical daily price change over 60 sessions; traded a day is the average over the last 20.</p>
          </section>
        ) : null}

        <aside className="mt-10 rounded-2xl bg-gray-100 p-5 text-xs leading-relaxed text-gray-500">
          <p><strong className="font-semibold text-gray-700">Educational content only, not investment advice.</strong> This is not a recommendation to buy or sell anything and does not take your goals or circumstances into account. NSE Academy is not a licensed investment adviser. Past performance does not predict future results.</p>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
}

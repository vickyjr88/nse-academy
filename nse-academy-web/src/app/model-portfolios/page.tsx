import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import Sparkline from "@/components/model-portfolios/Sparkline";
import { RISK_LABELS, listModelPortfolios } from "@/lib/model-portfolios";
import { fmtPct } from "@/lib/market-report";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "NSE Model Portfolios - Examples of Diversified Kenyan Stock Portfolios",
  description: "Illustrative NSE model portfolios, reviewed by a named professional and tracked on real closing prices. Study how they are built, then compare them with your own holdings.",
  alternates: { canonical: "/model-portfolios" },
};

export default async function ModelPortfoliosPage() {
  const { note, data } = await listModelPortfolios();
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
        <h1 className="mb-3 text-3xl font-bold text-gray-900">NSE model portfolios</h1>
        <p className="mb-10 max-w-2xl text-gray-600">
          Worked examples of how a Nairobi Securities Exchange portfolio can be put together for different investors. Each one is reviewed by a named professional and tracked on real closing prices from its start date. They are for learning, not personal advice.
        </p>

        {data.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
            No model portfolios have been published yet. Meanwhile, the <Link href="/investor-profiler" className="font-medium text-emerald-700 underline">investor profiler</Link> shows which style suits you.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {data.map((m) => (
              <Link key={m.slug} href={`/model-portfolios/${m.slug}`} className="rounded-3xl border border-gray-100 bg-white p-6 transition-colors hover:border-emerald-600">
                {m.riskProfile ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">{RISK_LABELS[m.riskProfile] ?? m.riskProfile}</p> : null}
                <h2 className="text-xl font-bold text-gray-900">{m.name}</h2>
                <p className="mt-1 text-sm text-gray-600">{m.summary}</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  {m.performance ? <Sparkline series={m.performance.series} label={`${m.name} since ${m.inceptionDate}`} /> : <span />}
                  {m.performance ? (
                    <div className="text-right">
                      <p className={`text-2xl font-bold tabular-nums ${m.performance.sincePct >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtPct(m.performance.sincePct)}</p>
                      <p className="text-xs text-gray-500">since {m.inceptionDate}</p>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-gray-500">{m.holdings.length} stocks: {m.holdings.slice(0, 5).map((h) => h.ticker).join(", ")}{m.holdings.length > 5 ? "…" : ""}</p>
              </Link>
            ))}
          </div>
        )}

        <aside className="mt-12 rounded-2xl bg-gray-100 p-5 text-xs leading-relaxed text-gray-500">
          <p><strong className="font-semibold text-gray-700">Educational content only, not investment advice.</strong> {note} NSE Academy is not a licensed investment adviser. A model is not built for your goals, so check it against your own situation or speak to a licensed adviser before acting.</p>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
}

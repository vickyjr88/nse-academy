import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import Sparkline from "@/components/model-portfolios/Sparkline";
import ModelActions from "@/components/model-portfolios/ModelActions";
import { RISK_LABELS, getModelPortfolio } from "@/lib/model-portfolios";
import { fmtPct } from "@/lib/market-report";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await getModelPortfolio(slug);
  if (!found) return { title: "Model portfolio not found - NSE Academy" };
  return {
    title: `${found.model.name} - NSE Model Portfolio`,
    description: found.model.summary,
    alternates: { canonical: `/model-portfolios/${found.model.slug}` },
  };
}

export default async function ModelPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getModelPortfolio(slug);
  if (!found) notFound();
  const { model: m, note } = found;
  const maxWeight = Math.max(...m.holdings.map((h) => h.weightPct), 1);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
          <Link href="/model-portfolios" className="hover:text-emerald-700">Model portfolios</Link>
        </nav>
        {m.riskProfile ? <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">{RISK_LABELS[m.riskProfile] ?? m.riskProfile}</p> : null}
        <h1 className="mb-3 text-3xl font-bold text-gray-900">{m.name}</h1>
        <p className="mb-6 max-w-2xl text-lg text-gray-600">{m.summary}</p>

        {m.performance ? (
          <section aria-label="Performance" className="mb-10 grid gap-6 rounded-3xl border border-gray-100 bg-white p-6 md:grid-cols-[1fr_auto] md:items-center">
            <Sparkline series={m.performance.series} label={`${m.name} value of 100 invested on ${m.inceptionDate}`} />
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Since {m.inceptionDate}</dt>
                <dd className={`text-2xl font-bold tabular-nums ${m.performance.sincePct >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtPct(m.performance.sincePct)}</dd>
              </div>
              {m.performance.last30Pct != null ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Last 30 days</dt>
                  <dd className={`text-2xl font-bold tabular-nums ${m.performance.last30Pct >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmtPct(m.performance.last30Pct)}</dd>
                </div>
              ) : null}
              <div className="col-span-2 text-xs text-gray-500">As of closing prices on {m.performance.asOf}. {note}</div>
            </dl>
          </section>
        ) : null}

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold text-gray-900">How it is built</h2>
          <div className="space-y-3 whitespace-pre-line leading-relaxed text-gray-700">{m.description}</div>
          {m.reviewedBy ? <p className="mt-4 text-sm text-gray-600">Reviewed by {m.reviewedBy}.</p> : null}
        </section>

        <section className="mb-10 rounded-3xl border border-gray-100 bg-white p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Holdings and weights</h2>
          <ul className="space-y-4">
            {m.holdings.map((h) => (
              <li key={h.ticker}>
                <div className="flex items-baseline justify-between gap-4">
                  <Link href={`/companies/${h.ticker}`} className="font-semibold text-gray-900 hover:text-emerald-700">{h.ticker}</Link>
                  <span className="font-semibold tabular-nums text-gray-900">{h.weightPct.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${(h.weightPct / maxWeight) * 100}%` }} /></div>
                {h.rationale ? <p className="mt-1 text-sm text-gray-600">{h.rationale}</p> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6">
          <h2 className="mb-2 text-xl font-bold text-gray-900">Compare it with your own portfolio</h2>
          <p className="mb-4 text-sm text-gray-700">See how closely your holdings match, and (Premium) copy these weights as your targets to get a rebalancing plan with your broker&apos;s fees.</p>
          <ModelActions slug={m.slug} />
        </section>

        <aside className="rounded-2xl bg-gray-100 p-5 text-xs leading-relaxed text-gray-500">
          <p><strong className="font-semibold text-gray-700">Educational content only, not investment advice.</strong> This model was not built for your goals, risk tolerance or tax position. NSE Academy is not a licensed investment adviser. Investments can fall as well as rise, and past performance does not predict future results.</p>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
}

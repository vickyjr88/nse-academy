import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { fmtKes, fmtPct, listMarketReports } from "@/lib/market-report";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "NSE Daily Market Report - NSE Academy",
  description:
    "What happened on the Nairobi Securities Exchange today: top gainers and losers, where the money traded, sector moves, and the lesson the numbers teach.",
  alternates: { canonical: "/market-report" },
};

export default async function MarketReportIndex() {
  const reports = await listMarketReports(60);

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6">
        <header className="mb-12">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-700">Every trading day</p>
          <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">NSE daily market report</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-600">
            The day on the Nairobi Securities Exchange in plain English: who moved, where the money traded, and the lesson the numbers teach.
            Written from the data, checked against it.
          </p>
        </header>

        {reports.length === 0 ? (
          <p className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">The first report is on its way. Check back after the next trading day.</p>
        ) : (
          <ul className="space-y-5">
            {reports.map((r, i) => (
              <li key={r.sessionYmd}>
                <Link
                  href={`/market-report/${r.sessionYmd}`}
                  className="block rounded-3xl border border-gray-100 p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {r.label}
                    {i === 0 ? <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Latest</span> : null}
                  </p>
                  <h2 className="mb-2 text-xl font-bold leading-snug text-gray-900">{r.headline}</h2>
                  <p className="mb-4 text-gray-600">{r.summary}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm tabular-nums">
                    <span className="text-emerald-700">{r.breadth.advancers} up</span>
                    <span className="text-red-600">{r.breadth.decliners} down</span>
                    <span className="text-gray-600">{fmtKes(r.valueTradedKes)} traded</span>
                    {r.topGainer ? <span className="text-gray-600">Top gainer <strong>{r.topGainer.ticker}</strong> {fmtPct(r.topGainer.changePct)}</span> : null}
                    {r.topLoser ? <span className="text-gray-600">Top loser <strong>{r.topLoser.ticker}</strong> {fmtPct(r.topLoser.changePct)}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-xs leading-relaxed text-gray-500">
          Educational content only, not investment advice. Prices come from a third-party feed and may be delayed or inaccurate.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

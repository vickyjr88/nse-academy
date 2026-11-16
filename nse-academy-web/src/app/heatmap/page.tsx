import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import MarketHeatmap from "@/components/MarketHeatmap";
import { getStockProfiles } from "@/lib/cms";
import { fmtCap, fmtChange, getHeatmap } from "@/lib/heatmap";
import { formatQuoteTime } from "@/lib/market-quote";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "NSE Heatmap: Today's Winners and Losers by Company Size | NSE Academy",
  description:
    "See the whole Nairobi Securities Exchange at a glance. Every listed company as a tile sized by market cap and coloured by today's price change, so you can see what moved the market.",
  alternates: { canonical: "/heatmap" },
  openGraph: {
    title: "NSE heatmap: the whole market at a glance",
    description: "Every NSE-listed company as a tile sized by market cap and coloured by today's price change.",
    url: "/heatmap",
    type: "website",
    siteName: "NSE Academy",
  },
  twitter: {
    card: "summary_large_image",
    title: "NSE heatmap: the whole market at a glance",
    description: "Every NSE-listed company as a tile sized by market cap and coloured by today's price change.",
  },
};

const tone = (pct: number) => (pct > 0 ? "text-emerald-700" : pct < 0 ? "text-red-600" : "text-gray-600");

export default async function HeatmapPage() {
  const [map, { profiles }] = await Promise.all([getHeatmap(), getStockProfiles({ limit: 200 })]);
  const linkable = profiles.map((p) => p.ticker.toUpperCase());

  const movers = map ? [...map.tiles].filter((t) => t.changePct !== 0).sort((a, b) => b.changePct - a.changePct) : [];
  const gainers = movers.filter((t) => t.changePct > 0).slice(0, 5);
  const losers = movers.filter((t) => t.changePct < 0).slice(-5).reverse();

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6">
        <header className="mb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-700">The market at a glance</p>
          <h1 className="mb-4 text-balance text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">NSE heatmap</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-gray-600">
            Every company on the Nairobi Securities Exchange as one tile. The bigger the company, the bigger the tile. Green means its share
            price is up today, red means it is down.
          </p>
        </header>

        {map && map.tiles.length > 0 ? (
          <>
            <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-gray-100 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Market today</dt>
                <dd className={`mt-1 text-2xl font-bold tabular-nums ${tone(map.changePct)}`}>{fmtChange(map.changePct)}</dd>
                <dd className="text-xs text-gray-500">weighted by company size</dd>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Combined value</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{fmtCap(map.totalMarketCap).replace("KSh ", "KSh ")}</dd>
                <dd className="text-xs text-gray-500">{map.tiles.length} companies</dd>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Up</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{map.advancers}</dd>
                <dd className="text-xs text-gray-500">companies rising</dd>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Down</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-red-600">{map.decliners}</dd>
                <dd className="text-xs text-gray-500">{map.unchanged} unchanged</dd>
              </div>
            </dl>

            <MarketHeatmap tiles={map.tiles} sectors={map.sectors} totalMarketCap={map.totalMarketCap} linkable={linkable} />

            {map.asOf ? <p className="mt-3 text-xs text-gray-500">Prices as at {formatQuoteTime(map.asOf)} (Nairobi time), delayed.</p> : null}

            <div className="mt-14 grid gap-10 md:grid-cols-2">
              <section aria-labelledby="up">
                <h2 id="up" className="mb-3 text-lg font-bold text-gray-900">Biggest risers</h2>
                <MoverList rows={gainers} />
              </section>
              <section aria-labelledby="down">
                <h2 id="down" className="mb-3 text-lg font-bold text-gray-900">Biggest fallers</h2>
                <MoverList rows={losers} />
              </section>
            </div>

            <section aria-labelledby="sectors" className="mt-14">
              <h2 id="sectors" className="mb-3 text-lg font-bold text-gray-900">By sector</h2>
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full min-w-[28rem] text-sm tabular-nums">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Sector</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Companies</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Share of market</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Today</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {map.sectors.map((s) => (
                      <tr key={s.sector}>
                        <th scope="row" className="px-4 py-3 text-left font-medium text-gray-900">{s.sector}</th>
                        <td className="px-4 py-3 text-right text-gray-600">{s.count}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{((s.marketCap / map.totalMarketCap) * 100).toFixed(s.marketCap / map.totalMarketCap < 0.01 ? 2 : 1)}%</td>
                        <td className={`px-4 py-3 text-right font-semibold ${tone(s.changePct)}`}>{fmtChange(s.changePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-14 max-w-3xl">
              <h2 className="mb-3 text-lg font-bold text-gray-900">How to read it</h2>
              <ul className="list-disc space-y-2 pl-5 leading-relaxed text-gray-600">
                <li>
                  <strong className="text-gray-900">Size is market cap</strong>: the share price times the number of shares the company has issued. Safaricom
                  is the big tile because it is worth more than most of the rest of the market put together.
                </li>
                <li>
                  <strong className="text-gray-900">Colour is today&apos;s move</strong>: the change in the share price since the last close. The deepest
                  colours mean {`3%`} or more.
                </li>
                <li>
                  A tiny tile can move a lot on a few trades. A big tile moving even half a percent shifts the whole market, which is why the headline
                  figure above is weighted by size.
                </li>
              </ul>
              <p className="mt-5 text-xs leading-relaxed text-gray-500">
                Share counts are from {new Date(map.sharesAsOf).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} and
                rounded, so market caps are close but not exact. Exchange-traded funds are left out because they are not companies. Educational content, not
                investment advice. Prices are delayed and for information only.{" "}
                <Link href="/market-report" className="underline hover:text-gray-700">Read today&apos;s market report</Link>.
              </p>
            </section>
          </>
        ) : (
          <p className="rounded-2xl bg-gray-50 p-8 text-center text-gray-500">The heatmap is not available right now. Please try again in a few minutes.</p>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function MoverList({ rows }: { rows: { ticker: string; name: string; changePct: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-500">None today.</p>;
  return (
    <ol className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {rows.map((r) => (
        <li key={r.ticker} className="flex items-center justify-between gap-4 px-4 py-3">
          <span className="min-w-0">
            <span className="font-semibold text-gray-900">{r.ticker}</span>
            <span className="ml-2 truncate text-sm text-gray-500">{r.name}</span>
          </span>
          <span className={`font-semibold tabular-nums ${tone(r.changePct)}`}>{fmtChange(r.changePct)}</span>
        </li>
      ))}
    </ol>
  );
}

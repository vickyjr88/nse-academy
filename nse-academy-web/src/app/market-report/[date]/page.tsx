import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import ShareBar from "@/components/market-report/ShareBar";
import PortfolioWatchTeaser from "@/components/market-report/PortfolioWatchTeaser";
import {
  CARD_SLIDES,
  MoverFact,
  fmtCompact,
  fmtKes,
  fmtPct,
  fmtPrice,
  getMarketReport,
  listMarketReports,
} from "@/lib/market-report";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nseacademy.vitaldigitalmedia.net";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const report = await getMarketReport(date);
  if (!report) return { title: "Market report not found - NSE Academy" };
  const url = `${SITE_URL}/market-report/${report.sessionYmd}`;
  return {
    title: `${report.headline} - NSE Academy`,
    description: report.summary,
    alternates: { canonical: url },
    // The share image comes from opengraph-image.tsx next to this page.
    openGraph: { title: report.headline, description: report.summary, url, type: "article", siteName: "NSE Academy", publishedTime: report.publishedAt ?? undefined },
    twitter: { card: "summary_large_image", title: report.headline, description: report.summary },
  };
}

function MoverList({ title, movers, tone }: { title: string; movers: MoverFact[]; tone: "up" | "down" }) {
  const max = Math.max(...movers.map((m) => Math.abs(m.changePct)), 0.01);
  const bar = tone === "up" ? "bg-emerald-500" : "bg-red-500";
  const text = tone === "up" ? "text-emerald-700" : "text-red-600";
  return (
    <section aria-labelledby={`h-${tone}`} className="rounded-3xl border border-gray-100 bg-white p-6">
      <h3 id={`h-${tone}`} className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {movers.length === 0 ? (
        <p className="text-sm text-gray-500">None met the liquidity threshold today.</p>
      ) : (
        <ul className="space-y-4">
          {movers.map((m) => (
            <li key={m.ticker}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <Link href={`/companies/${m.ticker}`} className="min-w-0 truncate font-semibold text-gray-900 hover:text-emerald-700">
                  {m.ticker} <span className="ml-1 truncate text-sm font-normal text-gray-500">{m.name}</span>
                </Link>
                <span className={`shrink-0 font-bold tabular-nums ${text}`}>{fmtPct(m.changePct)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(4, (Math.abs(m.changePct) / max) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs tabular-nums text-gray-500">KSh {fmtPrice(m.price)} &middot; {fmtKes(m.valueKes)} traded</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function MarketReportPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const [report, all] = await Promise.all([getMarketReport(date), listMarketReports(60)]);
  if (!report) notFound();

  const f = report.facts;
  const b = f.breadth;
  const total = Math.max(b.advancers + b.decliners + b.unchanged, 1);
  const idx = all.findIndex((r) => r.sessionYmd === report.sessionYmd);
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const maxSector = Math.max(...f.sectors.map((s) => Math.abs(s.changePct)), 0.01);
  const cardUrls = Array.from({ length: CARD_SLIDES }, (_, i) => `/market-report/${report.sessionYmd}/card/${i + 1}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: report.headline,
    description: report.summary,
    datePublished: report.publishedAt ?? undefined,
    mainEntityOfPage: `${SITE_URL}/market-report/${report.sessionYmd}`,
    author: { "@type": "Organization", name: "NSE Academy" },
    publisher: { "@type": "Organization", name: "NSE Academy" },
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-14 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-gray-500">
          <Link href="/market-report" className="hover:text-emerald-700">Market reports</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span>{report.sessionYmd}</span>
        </nav>

        <header className="mb-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-emerald-700">NSE daily market report &middot; {report.label}</p>
          <h1 className="mb-4 text-balance text-3xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl">{report.headline}</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-gray-600">{report.summary}</p>
        </header>

        {/* ---- the day in four numbers */}
        <section aria-label="Market snapshot" className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Stocks up", value: String(b.advancers), tone: "text-emerald-700" },
            { label: "Stocks down", value: String(b.decliners), tone: "text-red-600" },
            { label: "Value traded", value: fmtKes(f.valueTradedKes), tone: "text-gray-900" },
            { label: "Stocks traded", value: String(b.traded), tone: "text-gray-900" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${s.tone}`}>{s.value}</p>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-gray-100" role="img" aria-label={`${b.advancers} up, ${b.decliners} down, ${b.unchanged} unchanged`}>
              <div className="bg-emerald-500" style={{ width: `${(b.advancers / total) * 100}%` }} />
              <div className="bg-gray-300" style={{ width: `${(b.unchanged / total) * 100}%` }} />
              <div className="bg-red-500" style={{ width: `${(b.decliners / total) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {f.valueVsAvgNote ? <>Total value traded was {f.valueVsAvgNote}.</> : null}
              {f.previous ? <> The previous session had {f.previous.advancers} up and {f.previous.decliners} down.</> : null}
            </p>
          </div>
        </section>

        {/* ---- the story */}
        <section aria-labelledby="story" className="mb-14">
          <h2 id="story" className="mb-5 text-2xl font-bold text-gray-900">The story behind the numbers</h2>
          <div className="space-y-4 text-lg leading-relaxed text-gray-700">
            {report.story.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-900">
            {report.aiGenerated
              ? "This story was written by AI from the figures on this page, and every number in it was automatically checked against the data before publishing."
              : "This summary was generated directly from the figures on this page."}{" "}
            It describes what happened, not why. Prices can move for reasons this data cannot show.
          </p>
        </section>

        {/* ---- movers */}
        <section aria-labelledby="movers" className="mb-14">
          <h2 id="movers" className="mb-1 text-2xl font-bold text-gray-900">Top movers</h2>
          <p className="mb-5 text-sm text-gray-500">Only stocks with at least KSh 100,000 traded are ranked, so a handful of shares at an odd price does not crowd out real moves.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <MoverList title="Top gainers" movers={f.gainers} tone="up" />
            <MoverList title="Top losers" movers={f.losers} tone="down" />
          </div>
        </section>

        {/* ---- activity */}
        <section aria-labelledby="activity" className="mb-14">
          <h2 id="activity" className="mb-5 text-2xl font-bold text-gray-900">Where the money traded</h2>
          <div className="overflow-x-auto rounded-3xl border border-gray-100">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Most active stocks by value traded</caption>
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Stock</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Value traded</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Change</th>
                  <th scope="col" className="hidden px-5 py-3 text-right font-semibold sm:table-cell">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {f.active.map((m) => (
                  <tr key={m.ticker}>
                    <td className="px-5 py-3">
                      <Link href={`/companies/${m.ticker}`} className="font-semibold text-gray-900 hover:text-emerald-700">{m.ticker}</Link>
                      <span className="ml-2 text-gray-500">{m.name}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{fmtKes(m.valueKes)}</td>
                    <td className={`px-5 py-3 text-right font-bold tabular-nums ${m.changePct > 0 ? "text-emerald-700" : m.changePct < 0 ? "text-red-600" : "text-gray-500"}`}>{fmtPct(m.changePct)}</td>
                    <td className="hidden px-5 py-3 text-right tabular-nums text-gray-600 sm:table-cell">{fmtCompact(m.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {f.concentration ? (
            <p className="mt-3 text-sm text-gray-500">{f.concentration.name} ({f.concentration.ticker}) alone made up {f.concentration.sharePct}% of everything traded.</p>
          ) : null}

          {f.volumeSpikes.length > 0 || f.limitMoves.length > 0 ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {f.volumeSpikes.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-900">Unusual volume</h3>
                  <ul className="space-y-1 text-sm text-amber-950">
                    {f.volumeSpikes.map((s) => (
                      <li key={s.ticker}><strong>{s.ticker}</strong> traded {s.multiple}x its usual value ({fmtKes(s.valueKes)}) and moved {fmtPct(s.changePct)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {f.limitMoves.length > 0 ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-900">At the daily price limit</h3>
                  <ul className="space-y-1 text-sm text-red-950">
                    {f.limitMoves.map((s) => (
                      <li key={s.ticker}><strong>{s.ticker}</strong> {s.name}: {fmtPct(s.changePct)} to KSh {fmtPrice(s.price)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ---- sectors */}
        {f.sectors.length > 0 ? (
          <section aria-labelledby="sectors" className="mb-14">
            <h2 id="sectors" className="mb-1 text-2xl font-bold text-gray-900">Sectors</h2>
            <p className="mb-5 text-sm text-gray-500">Average change by sector, weighted by value traded.</p>
            <ul className="space-y-3">
              {f.sectors.map((s) => (
                <li key={s.sector} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_5rem]">
                  <span className="truncate text-sm text-gray-700">{s.sector}<span className="ml-1 text-gray-400">({s.stocks})</span></span>
                  <div className="relative h-5 rounded-full bg-gray-100" aria-hidden="true">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300" />
                    <div
                      className={`absolute inset-y-1 rounded-full ${s.changePct >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                      style={s.changePct >= 0 ? { left: "50%", width: `${(Math.abs(s.changePct) / maxSector) * 50}%` } : { right: "50%", width: `${(Math.abs(s.changePct) / maxSector) * 50}%` }}
                    />
                  </div>
                  <span className={`text-right text-sm font-semibold tabular-nums ${s.changePct > 0 ? "text-emerald-700" : s.changePct < 0 ? "text-red-600" : "text-gray-500"}`}>{fmtPct(s.changePct)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---- lessons: the point of the page */}
        <section aria-labelledby="lessons" className="mb-14">
          <h2 id="lessons" className="mb-1 text-2xl font-bold text-gray-900">What today&apos;s data teaches</h2>
          <p className="mb-5 text-sm text-gray-500">Reading the market is a skill. Each day we pick the lessons this data illustrates best.</p>
          <div className={`grid gap-5 ${report.lessons.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {report.lessons.map((l) => (
              <article key={l.title} className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6">
                <h3 className="mb-2 text-lg font-bold text-gray-900">{l.title}</h3>
                <p className="leading-relaxed text-gray-700">{l.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">New to these terms? See the <Link href="/glossary" className="font-medium text-emerald-700 underline">NSE glossary</Link> or take the <Link href="/investor-profiler" className="font-medium text-emerald-700 underline">investor profiler</Link>.</p>
        </section>

        {/* ---- pointer to the Portfolio Watch example */}
        <PortfolioWatchTeaser sessionYmd={report.sessionYmd} />

        {/* ---- share */}
        <section aria-labelledby="share" className="mb-14 rounded-3xl border border-gray-100 bg-white p-6 md:p-8">
          <h2 id="share" className="mb-5 text-2xl font-bold text-gray-900">Share with your community</h2>
          <ShareBar url={report.url} whatsapp={report.share.whatsapp} xPost={report.share.xPost} caption={report.share.caption} hashtags={report.share.hashtags} cardUrls={cardUrls} />
        </section>

        {/* ---- previous / next session */}
        {newer || older ? (
          <nav aria-label="Other reports" className="mb-12 grid gap-4 sm:grid-cols-2">
            {older ? (
              <Link href={`/market-report/${older.sessionYmd}`} className="rounded-2xl border border-gray-100 p-5 transition-colors hover:border-emerald-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Previous session</p>
                <p className="mt-1 font-semibold text-gray-900">{older.headline}</p>
              </Link>
            ) : <span />}
            {newer ? (
              <Link href={`/market-report/${newer.sessionYmd}`} className="rounded-2xl border border-gray-100 p-5 text-right transition-colors hover:border-emerald-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next session</p>
                <p className="mt-1 font-semibold text-gray-900">{newer.headline}</p>
              </Link>
            ) : null}
          </nav>
        ) : null}

        <aside className="rounded-2xl bg-gray-50 p-5 text-xs leading-relaxed text-gray-500">
          <p>
            <strong className="font-semibold text-gray-700">Educational content only - not investment advice.</strong> NSE Academy is an independent
            education platform, not a licensed investment adviser, and is not affiliated with the Nairobi Securities Exchange or the Capital Markets
            Authority. Prices and volumes come from a third-party data feed and may be delayed or contain errors; verify with your broker before acting.
            Past movements do not predict future results.
          </p>
        </aside>
      </main>

      <PublicFooter />
    </div>
  );
}

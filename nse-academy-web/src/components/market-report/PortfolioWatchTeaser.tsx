import { TrackedLink } from "@/components/TrackedLink";

/** A pointer from the daily report to the Portfolio Watch example: readers of closing prices are the audience for it. */
export default function PortfolioWatchTeaser({ sessionYmd }: { sessionYmd: string }) {
  return (
    <section aria-labelledby="pw-teaser" className="mb-14 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 md:p-8">
      <h2 id="pw-teaser" className="mb-2 text-xl font-bold text-gray-900">What would this close mean for your portfolio?</h2>
      <p className="mb-4 max-w-2xl leading-relaxed text-gray-700">
        Reading the market is one thing. Knowing which of your own holdings moved, are near a 60-day high or low, or have grown too large
        is another. Portfolio Watch emails Premium members a short check on their own shares after every close.
      </p>
      <TrackedLink
        href="/pricing#portfolio-watch"
        event="market_report_portfolio_watch_click"
        eventProps={{ session: sessionYmd }}
        className="inline-block rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-800"
      >
        See an example on real closing prices &rarr;
      </TrackedLink>
    </section>
  );
}

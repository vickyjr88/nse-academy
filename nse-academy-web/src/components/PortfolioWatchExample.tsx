import Link from "next/link";
import type { PortfolioWatchExample as Example } from "@/lib/portfolio-watch-example";
import { fmtPct, fmtPrice } from "@/lib/market-report";

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString("en-KE")}`;
const signedKes = (n: number) => `${n >= 0 ? "+" : "-"}KSh ${Math.abs(Math.round(n)).toLocaleString("en-KE")}`;
const tone = (n: number | null) => (n == null || n === 0 ? "text-gray-500" : n > 0 ? "text-emerald-700" : "text-red-600");

/** A worked example of the daily Portfolio Watch email, on real closing prices. */
export default function PortfolioWatchExample({ example }: { example: Example }) {
  return (
    <section id="portfolio-watch" aria-labelledby="pw-heading" className="mt-20 scroll-mt-24">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Included in Premium</p>
        <h2 id="pw-heading" className="mb-2 text-2xl font-bold text-gray-900">See Portfolio Watch at work</h2>
        <p className="mx-auto max-w-2xl text-gray-500">
          The NSE closes at 15:00. Every trading day by 16:30, Premium members get a short email about their own holdings.
          Here is one for an example portfolio, on the real closing prices of {example.asOfLabel}.
        </p>
      </div>

      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 md:p-8">
        <dl className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Portfolio value</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900">{kes(example.valueKes)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Today</dt>
            <dd className={`mt-1 text-xl font-bold tabular-nums ${tone(example.dayChangeKes)}`}>
              {signedKes(example.dayChangeKes)}
              {example.dayChangePct != null ? <span className="ml-1 text-sm font-semibold">({fmtPct(example.dayChangePct)})</span> : null}
            </dd>
          </div>
          {example.unrealizedKes != null && example.unrealizedPct != null ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gain on cost</dt>
              <dd className={`mt-1 text-xl font-bold tabular-nums ${tone(example.unrealizedKes)}`}>
                {signedKes(example.unrealizedKes)}
                <span className="ml-1 text-sm font-semibold">({fmtPct(example.unrealizedPct)})</span>
              </dd>
            </div>
          ) : null}
        </dl>

        {example.items.length > 0 ? (
          <>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-900">Worth a look</h3>
            <ul className="mb-6 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-gray-800">
              {example.items.map((i) => (
                <li key={`${i.kind}-${i.ticker}`}>{i.text}</li>
              ))}
            </ul>
          </>
        ) : null}

        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-900">Your holdings</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-semibold">Stock</th>
                <th className="py-2 pr-3 text-right font-semibold">Shares</th>
                <th className="py-2 pr-3 text-right font-semibold">Price</th>
                <th className="py-2 pr-3 text-right font-semibold">Today</th>
                <th className="py-2 pr-3 text-right font-semibold">Value</th>
                <th className="py-2 text-right font-semibold">On cost</th>
              </tr>
            </thead>
            <tbody>
              {example.holdings.map((h) => (
                <tr key={h.ticker} className="border-b border-gray-100 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold text-gray-900">
                    <Link href={`/companies/${h.ticker}`} className="hover:text-emerald-700">{h.ticker}</Link>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{h.quantity.toLocaleString("en-KE")}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{fmtPrice(h.price)}</td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums ${tone(h.dayChangePct)}`}>{h.dayChangePct != null ? fmtPct(h.dayChangePct) : "-"}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-gray-700">{kes(h.valueKes)}</td>
                  <td className={`py-2.5 text-right tabular-nums ${tone(h.gainPct)}`}>{h.gainPct != null ? fmtPct(h.gainPct) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-gray-500">
          Illustrative: the shares and costs are made up for this example. The prices and the way each flag is worked out are real.
          Information only, not investment advice.
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-3xl text-center">
        <p className="mb-4 text-sm text-gray-600">
          Portfolio Watch flags big moves, gains and losses against your cost, stocks near a 60-day high or low, and over-concentration,
          and stays quiet when there is nothing worth saying.
        </p>
        <Link href="/auth/register?plan=premium" className="inline-block rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white transition-colors hover:bg-emerald-800">
          Start Premium
        </Link>
      </div>
    </section>
  );
}

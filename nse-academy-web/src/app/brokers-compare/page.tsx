import Link from "next/link";
import { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { listPublicBrokers } from "@/lib/brokers";

export const metadata: Metadata = {
  title: "Compare NSE Broker Fees - NSE Academy",
  description:
    "Compare brokerage fees across licensed NSE stockbrokers and CDS agents in Kenya, including flat-rate trading platforms like Ziidi Trader.",
};

const AIB_AXYS_REFERRAL_URL =
  "https://aibaxys.kenyaonlinetrading.com/ActiveTrader/#!/new-trading-account?ReferralCode=REF39870";

export default async function BrokersComparePage() {
  const brokers = await listPublicBrokers();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicHeader />

      <main className="flex-1 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Compare NSE broker fees</h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              Brokerage fees eat into every trade. See what licensed NSE stockbrokers and CDS agents
              charge before you open an account.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-x-auto mb-10">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-gray-100">
                  <th className="px-5 py-4">Broker</th>
                  <th className="px-5 py-4 text-right">Fee</th>
                  <th className="px-5 py-4 text-center">CDS account required</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-4 font-semibold text-gray-900">{b.name}</td>
                    <td className="px-5 py-4 text-right text-gray-900">{b.feePercent}%</td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          b.cdsRequired ? "bg-gray-50 text-gray-500" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {b.cdsRequired ? "Required" : "Not required"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
              <h2 className="font-bold text-emerald-900 mb-2">Track your trades and fees automatically</h2>
              <p className="text-sm text-emerald-800 mb-5">
                NSE Academy&apos;s Trade Journal logs every trade, computes real fees per broker, and
                shows your true cost basis and portfolio in one place.
              </p>
              <Link
                href="/dashboard/journal"
                className="inline-flex items-center justify-center h-11 px-6 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all text-sm"
              >
                Open the Trade Journal →
              </Link>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-bold text-gray-900 mb-2">Ready to open an account?</h2>
              <p className="text-sm text-gray-500 mb-5">
                Open a CDS account with our trusted broker partner and start trading NSE shares today.
              </p>
              <a
                href={AIB_AXYS_REFERRAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 px-6 font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all text-sm"
              >
                Open Account with AIB AXYS →
              </a>
            </div>
          </div>

          <p className="mt-8 text-xs text-gray-400 text-center">
            Fees shown are approximate all-in rates (commission + statutory levies) and may change.
            NSE Academy is not a licensed investment advisor. Always confirm current rates with the broker.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

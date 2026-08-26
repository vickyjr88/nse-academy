import Link from "next/link";
import { listPublicAdvisors } from "@/lib/advisor-public";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Financial Advisors - NSE Academy",
  description: "Connect with independent financial advisors offering personalised NSE investment guidance.",
};

export default async function AdvisorsPage() {
  const { data: advisors } = await listPublicAdvisors({ limit: 100 });

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Financial Advisors
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl">
            Connect with independent financial advisors for personalised guidance on your NSE portfolio.
            Billing for advisory services is arranged directly with the advisor, outside the platform.
          </p>
        </div>

        {advisors.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {advisors.map((advisor) => (
              <Link
                key={advisor.id}
                href={`/advisors/${advisor.id}`}
                className="group border border-gray-100 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 bg-white"
              >
                <div className="flex items-center gap-4 mb-4">
                  {advisor.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={advisor.photoUrl}
                      alt={advisor.user?.name ?? "Advisor"}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl">
                      {(advisor.user?.name ?? "A").charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                      {advisor.user?.name ?? "Advisor"}
                    </h3>
                    <p className="text-sm text-gray-500">{advisor.headline}</p>
                  </div>
                </div>
                {advisor.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {advisor.specialties.slice(0, 3).map((s) => (
                      <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500 line-clamp-2">{advisor.bio}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-gray-50 rounded-2xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900">No advisors listed yet.</h3>
            <p className="text-gray-500 mt-2">Check back soon.</p>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

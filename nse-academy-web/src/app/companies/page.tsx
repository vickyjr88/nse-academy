import Link from "next/link";
import { getStockProfiles } from "@/lib/cms";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const metadata = {
  title: "Listed Companies - NSE Academy",
  description: "Explore profiles of publicly traded companies on the Nairobi Securities Exchange.",
};

export default async function CompaniesPage() {
  const { profiles } = await getStockProfiles({ limit: 200 });

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
            Listed Companies
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl">
            Discover comprehensive profiles, historical context, and investor suitability metrics for businesses listed on the Nairobi Securities Exchange.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <Link
              key={profile.ticker}
              href={`/companies/${profile.ticker.toLowerCase()}`}
              className="group block"
            >
              <div className="h-full bg-white border border-gray-100 rounded-2xl p-6 transition-all duration-300 hover:border-emerald-200 hover:shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-md text-sm">
                    {profile.ticker}
                  </div>
                  <div className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {profile.sector}
                  </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                  {profile.company_name}
                </h2>
                
                <p className="text-sm text-gray-500 line-clamp-3 mb-6 leading-relaxed">
                  {profile.description}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Risk Level</span>
                    <span className={`text-sm font-bold capitalize ${
                      profile.risk_level === 'low' ? 'text-emerald-600' : 
                      profile.risk_level === 'medium' ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {profile.risk_level}
                    </span>
                  </div>
                  {profile.dividend_yield !== null && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Div Yield</span>
                      <span className="text-sm font-bold text-emerald-700">
                        {profile.dividend_yield}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
        
        {profiles.length === 0 && (
          <div className="text-center py-24 bg-gray-50 rounded-2xl border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900">No company profiles found.</h3>
            <p className="text-gray-500 mt-2">Run the seed script to populate company data.</p>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}


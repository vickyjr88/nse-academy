import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getStockProfileByTicker, getStockProfiles } from "@/lib/cms";
import CompanyPriceWidget from "@/components/CompanyPriceWidget";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

interface Props {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const profile = await getStockProfileByTicker(ticker.toUpperCase());
  
  if (!profile) return { title: "Company Not Found" };

  return {
    title: `${profile.company_name} (${profile.ticker}) | NSE Academy`,
    description: profile.description.slice(0, 160),
    openGraph: {
      title: `${profile.company_name} Analysis & Live Price`,
      description: profile.description.slice(0, 160),
    }
  };
}

export async function generateStaticParams() {
  const { profiles } = await getStockProfiles({ limit: 100 });
  return profiles.map((p) => ({
    ticker: p.ticker.toLowerCase(),
  }));
}

export default async function CompanyDetailPage({ params }: Props) {
  const { ticker } = await params;
  const profile = await getStockProfileByTicker(ticker.toUpperCase());

  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <PublicHeader />
      
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          
          {/* Breadcrumbs */}
          <nav className="flex mb-8 text-sm text-gray-400 font-medium space-x-2">
            <Link href="/" className="hover:text-emerald-700 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/companies" className="hover:text-emerald-700 transition-colors">Companies</Link>
            <span>/</span>
            <span className="text-gray-900 uppercase tracking-wider">{profile.ticker}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Left Content Column */}
            <div className="lg:col-span-2 space-y-10">
              <section>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                  <div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
                      {profile.company_name}
                    </h1>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-md text-sm">
                        {profile.ticker}
                      </span>
                      <span className="text-gray-500 bg-gray-50 px-3 py-1 rounded-md text-sm uppercase tracking-wider font-semibold">
                        {profile.sector}
                      </span>
                      <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                        profile.risk_level === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                        profile.risk_level === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                        'bg-rose-50 text-rose-700 border-rose-100'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          profile.risk_level === 'low' ? 'bg-emerald-500' : 
                          profile.risk_level === 'medium' ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        <span className="capitalize">{profile.risk_level} Risk</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="prose prose-slate max-w-none">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 border-l-4 border-emerald-600 pl-4">About the Company</h2>
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {profile.description}
                  </p>
                </div>
              </section>

              <section className="bg-gray-50 border border-gray-100 rounded-3xl p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Investment Suitability</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profile.investor_types && profile.investor_types.length > 0 ? (
                    profile.investor_types.map((type) => (
                      <div key={type} className="flex items-start space-x-3 bg-white p-5 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-colors">
                        <div className="mt-1 flex-shrink-0 w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 text-xs">
                          ✓
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 capitalize">{type} Profiles</h4>
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            Suggested for individuals seeking {type === 'dividend' ? 'regular yield' : type === 'growth' ? 'capital appreciation' : 'market exposure'}.
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-4 text-gray-400 italic">No specific investor profile matches yet.</div>
                  )}
                </div>
              </section>
            </div>

            {/* Sticky Sidebar */}
            <div className="space-y-8">
              <div className="sticky top-28 space-y-8">
                <CompanyPriceWidget ticker={profile.ticker} />
                
                <div className="bg-emerald-700 rounded-3xl p-8 text-white relative overflow-hidden group shadow-lg">
                  <h3 className="text-xl font-bold mb-4">Join the Academy</h3>
                  <p className="text-emerald-50 mb-6 leading-relaxed text-sm">
                    Want to learn how to trade stocks like {profile.company_name}? Unlock our premium investor education tracks today.
                  </p>
                  <Link 
                    href="/auth/register" 
                    className="flex items-center justify-center w-full py-3.5 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-all active:scale-95 shadow-sm"
                  >
                    Get Started Free
                  </Link>
                </div>

                <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl">
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Sectors Metrics</h4>
                   <div className="flex justify-between items-center">
                     <span className="text-gray-600 text-sm">Target Div. Yield</span>
                     <span className="text-emerald-700 font-bold">{profile.dividend_yield ? `${profile.dividend_yield}%` : 'N/A'}</span>
                   </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

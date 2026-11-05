import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { getStockProfileByTicker, getStockProfiles, type StockProfile } from "@/lib/cms";
import { getMarketQuote } from "@/lib/market-quote";
import { SITE_NAME, abs, breadcrumbJsonLd, faqJsonLd, leadSentence, truncate } from "@/lib/seo";
import CompanyPriceWidget from "@/components/CompanyPriceWidget";
import JsonLd from "@/components/JsonLd";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

interface Props {
  params: Promise<{ ticker: string }>;
}

// One URL per company. The sitemap and every internal link use the upper-case ticker; the lower-case
// spelling used to be linked from the company list, so both existed and neither had a canonical.
const companyPath = (ticker: string) => `/companies/${ticker.toUpperCase()}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker } = await params;
  const profile = await getStockProfileByTicker(ticker.toUpperCase());

  if (!profile) return { title: "Company Not Found", robots: { index: false } };

  const url = abs(companyPath(profile.ticker));
  const title = `${profile.company_name} (${profile.ticker}) Share Price & Profile | ${SITE_NAME}`;
  // Keywords first: Google cuts around 155 characters, and the company's own summary is the part that can go.
  const description = truncate(
    `${profile.company_name} (NSE: ${profile.ticker}) share price, dividend yield and risk profile. ${profile.sector} stock on the Nairobi Securities Exchange. ${leadSentence(profile.description)}`,
    158,
  );

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${profile.company_name} (${profile.ticker}) - NSE share price & profile`,
      description,
      url,
      type: "website",
      siteName: SITE_NAME,
    },
    twitter: { card: "summary_large_image", title: `${profile.company_name} (${profile.ticker})`, description },
  };
}

export async function generateStaticParams() {
  const { profiles } = await getStockProfiles({ limit: 100 });
  return profiles.map((p) => ({
    ticker: p.ticker.toUpperCase(),
  }));
}

function companyFaqs(profile: StockProfile): { q: string; a: string }[] {
  const name = profile.company_name;
  const faqs = [
    { q: `What does ${name} do?`, a: profile.description },
    {
      q: `What is the NSE ticker for ${name}?`,
      a: `${name} trades on the Nairobi Securities Exchange (NSE) under the ticker ${profile.ticker}. It is classified in the ${profile.sector} sector.`,
    },
    {
      q: `Does ${name} pay dividends?`,
      a: profile.dividend_yield
        ? `NSE Academy lists a target dividend yield of ${profile.dividend_yield}% for ${name}. Actual yield moves with the share price and with each dividend the board declares, so check the company's latest announcement before you invest.`
        : `NSE Academy does not currently list a dividend yield for ${name}. Check the company's latest results and dividend announcements for its current policy.`,
    },
    {
      q: `How risky is ${name}?`,
      a: `NSE Academy rates ${name} as ${profile.risk_level} risk within the ${profile.sector} sector. This is an educational classification, not investment advice - every share can lose value.`,
    },
    {
      q: `How do I buy ${name} shares?`,
      a: `Open a CDS account through a licensed Kenyan stockbroker, fund it, then place a buy order for ${profile.ticker}. You can compare broker fees on NSE Academy before you choose one.`,
    },
  ];
  return faqs;
}

export default async function CompanyDetailPage({ params }: Props) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  if (ticker !== upper) permanentRedirect(companyPath(upper));

  const [profile, quote, { profiles: all }] = await Promise.all([
    getStockProfileByTicker(upper),
    getMarketQuote(upper),
    getStockProfiles({ limit: 100 }),
  ]);

  if (!profile) notFound();

  const faqs = companyFaqs(profile);
  // The CMS sometimes stores an empty list as the string "[]", which rendered as a card titled "[] Profiles".
  const investorTypes = (profile.investor_types ?? []).filter((t) => /[a-z]/i.test(t));
  const related = all.filter((p) => p.sector === profile.sector && p.ticker !== profile.ticker).slice(0, 6);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Corporation",
          name: profile.company_name,
          tickerSymbol: `NSE:${profile.ticker}`,
          description: profile.description,
          url: abs(companyPath(profile.ticker)),
          industry: profile.sector,
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Companies", path: "/companies" },
          { name: profile.company_name, path: companyPath(profile.ticker) },
        ])}
      />
      <JsonLd data={faqJsonLd(faqs)} />
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
                  {investorTypes.length > 0 ? (
                    investorTypes.map((type) => (
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

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6 border-l-4 border-emerald-600 pl-4">
                  {profile.company_name} FAQs
                </h2>
                <div className="space-y-6">
                  {faqs.slice(1).map((f) => (
                    <div key={f.q}>
                      <h3 className="font-bold text-gray-900 mb-1.5">{f.q}</h3>
                      <p className="text-gray-600 leading-relaxed">{f.a}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-6">
                  Educational content, not investment advice. Prices are delayed and for information only.{" "}
                  <Link href="/brokers-compare" className="text-emerald-700 hover:underline">Compare NSE brokers</Link>
                  {" · "}
                  <Link href="/market-report" className="text-emerald-700 hover:underline">Read the daily market report</Link>
                </p>
              </section>

              {related.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Other {profile.sector} companies on the NSE</h2>
                  <ul className="flex flex-wrap gap-2">
                    {related.map((p) => (
                      <li key={p.ticker}>
                        <Link
                          href={companyPath(p.ticker)}
                          className="inline-block px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                        >
                          {p.company_name} <span className="text-gray-400">({p.ticker})</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Sticky Sidebar */}
            <div className="space-y-8">
              <div className="sticky top-28 space-y-8">
                <CompanyPriceWidget ticker={profile.ticker} initial={quote} />
                
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
    </>
  );
}

import Link from "next/link";
import { getStockProfiles } from "@/lib/cms";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import CompanySearch from "@/components/CompanySearch";

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

        {profiles.length > 0 ? (
          <CompanySearch profiles={profiles} />
        ) : (
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


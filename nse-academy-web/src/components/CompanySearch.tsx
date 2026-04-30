"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { type StockProfile } from "@/lib/cms";

export default function CompanySearch({ profiles }: { profiles: StockProfile[] }) {
  const [query, setQuery] = useState("");

  const filteredProfiles = profiles.filter((profile) => {
    const q = query.toLowerCase();
    return (
      profile.company_name.toLowerCase().includes(q) ||
      profile.ticker.toLowerCase().includes(q) ||
      profile.sector.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-8 relative max-w-lg mx-auto md:mx-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all shadow-sm"
          placeholder="Search by company name, ticker, or sector..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProfiles.map((profile) => (
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

      {filteredProfiles.length === 0 && (
        <div className="text-center py-24 bg-gray-50 rounded-2xl border border-gray-100 mt-6">
          <h3 className="text-xl font-bold text-gray-900">No companies found.</h3>
          <p className="text-gray-500 mt-2">Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
}

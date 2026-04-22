import Link from "next/link";
import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import GlossaryClient, { type GlossaryTerm } from "../dashboard/glossary/GlossaryClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NSE Glossary — NSE Academy",
  description:
    "Searchable A-Z glossary of Kenyan capital markets terms — from A/P ratio to yield curve. Free for all investors.",
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchGlossaryTerms(): Promise<GlossaryTerm[]> {
  const cmsUrl = process.env.CMS_INTERNAL_URL || process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:1337";
  try {
    const res = await fetch(
      `${cmsUrl}/api/glossary-terms?pagination[limit]=500&sort=term:asc`,
      { cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []) as GlossaryTerm[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PublicGlossaryPage() {
  const terms = await fetchGlossaryTerms();

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
            📚 NSE Academy Resources
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">NSE Glossary</h1>
          <p className="text-gray-500 max-w-2xl mx-auto text-lg">
            {terms.length > 0
              ? `Master the language of the Nairobi Securities Exchange. Browse ${terms.length} terms from A-Z.`
              : "All the capital markets terms you need to invest with confidence on the NSE."}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          {terms.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <div className="text-5xl mb-4">💡</div>
              <p className="text-lg font-medium">Coming soon.</p>
              <p className="text-sm mt-1">
                We are currently populating our glossary with comprehensive definitions.
              </p>
            </div>
          ) : (
            <GlossaryClient terms={terms} />
          )}
        </div>

        {/* CTA */}
        <div className="mt-20 bg-emerald-700 rounded-3xl p-8 sm:p-12 text-center text-white shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to put your knowledge to use?</h2>
          <p className="text-emerald-100 mb-8 max-w-xl mx-auto">
            Find your investor type and get a personalized learning path to start building your portfolio today.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-white text-emerald-700 font-bold px-8 py-4 rounded-xl hover:bg-emerald-50 transition-colors shadow-sm"
          >
            Start Learning Free →
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

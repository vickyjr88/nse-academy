import Link from "next/link";
import type { Metadata } from "next";
import GlossaryClient, { type GlossaryTerm } from "./GlossaryClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NSE Glossary — NSE Academy",
  description:
    "Searchable A-Z glossary of Kenyan capital markets terms — from A/P ratio to yield curve.",
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

export default async function GlossaryPage() {
  const terms = await fetchGlossaryTerms();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-emerald-700 text-lg">
            NSE Academy
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-500">
            <Link href="/learn" className="hover:text-gray-900 transition-colors">Courses</Link>
            <Link href="/glossary" className="text-emerald-700 font-semibold">Glossary</Link>
            <Link href="/dashboard" className="hover:text-gray-900 transition-colors">Dashboard</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">NSE Glossary</h1>
          <p className="text-gray-500 mt-2">
            {terms.length > 0
              ? `${terms.length} terms — search or browse A-Z.`
              : "All the capital markets terms you need to invest with confidence."}
          </p>
        </div>

        {terms.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-5xl mb-4">💡</div>
            <p className="text-lg font-medium">No terms yet.</p>
            <p className="text-sm mt-1">
              Run{" "}
              <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                npx ts-node scripts/seed-glossary.ts
              </code>{" "}
              to populate the glossary.
            </p>
          </div>
        ) : (
          <GlossaryClient terms={terms} />
        )}
      </main>
    </div>
  );
}

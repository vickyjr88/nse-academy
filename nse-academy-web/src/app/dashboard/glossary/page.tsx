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
    <div>
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
    </div>
  );
}

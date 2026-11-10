import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { listResearch } from "@/lib/research";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "NSE Research - Monthly Focus List and Company Briefs",
  description: "Each month, the NSE stocks that stood out on three fixed screens, plus company briefs, with the numbers shown and a named reviewer. Educational, not advice.",
  alternates: { canonical: "/research" },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");

export default async function ResearchPage() {
  const notes = await listResearch();
  const lists = notes.filter((n) => n.kind === "FOCUS_LIST");
  const briefs = notes.filter((n) => n.kind === "BRIEF");
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-14">
        <h1 className="mb-3 text-3xl font-bold text-gray-900">NSE research</h1>
        <p className="mb-10 max-w-2xl text-gray-600">Stocks worth a closer look, with the numbers behind each one and the name of the person who reviewed it. Education, not advice.</p>

        {notes.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">Nothing has been published yet. Meanwhile, read the <Link href="/market-report" className="font-medium text-emerald-700 underline">daily market report</Link>.</div>
        ) : null}

        {lists.length > 0 ? (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Monthly focus list</h2>
            <div className="space-y-4">
              {lists.map((n) => (
                <Link key={n.slug} href={`/research/${n.slug}`} className="block rounded-2xl border border-gray-100 bg-white p-5 transition-colors hover:border-emerald-600">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{n.summary}</p>
                  <p className="mt-2 text-xs text-gray-500">{n.tickers.join(", ")} &middot; reviewed by {n.reviewedBy} &middot; {when(n.publishedAt)}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {briefs.length > 0 ? (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold text-gray-900">Company briefs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {briefs.map((n) => (
                <Link key={n.slug} href={`/research/${n.slug}`} className="block rounded-2xl border border-gray-100 bg-white p-5 transition-colors hover:border-emerald-600">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="mt-1 text-sm text-gray-600">{n.summary}</p>
                  <p className="mt-2 text-xs text-gray-500">reviewed by {n.reviewedBy} &middot; {when(n.publishedAt)}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <aside className="rounded-2xl bg-gray-100 p-5 text-xs leading-relaxed text-gray-500">
          <p><strong className="font-semibold text-gray-700">Educational content only, not investment advice.</strong> Nothing here is a recommendation to buy or sell. NSE Academy is not a licensed investment adviser. Do your own research or speak to a licensed adviser before you invest.</p>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
}

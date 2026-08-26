import { notFound } from "next/navigation";
import { getPublicAdvisor } from "@/lib/advisor-public";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import ConnectButton from "./ConnectButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const advisor = await getPublicAdvisor(id);
    return {
      title: `${advisor.user?.name ?? "Advisor"} - NSE Academy Financial Advisors`,
      description: advisor.headline,
    };
  } catch {
    return { title: "Financial Advisor - NSE Academy" };
  }
}

export default async function AdvisorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let advisor;
  try {
    advisor = await getPublicAdvisor(id);
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <div className="flex items-center gap-5 mb-8">
          {advisor.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={advisor.photoUrl} alt={advisor.user?.name ?? "Advisor"} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-3xl">
              {(advisor.user?.name ?? "A").charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{advisor.user?.name ?? "Advisor"}</h1>
            <p className="text-gray-500">{advisor.headline}</p>
            {advisor.credentials && (
              <p className="text-sm text-emerald-700 font-medium mt-1">{advisor.credentials}</p>
            )}
          </div>
        </div>

        {advisor.specialties.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {advisor.specialties.map((s) => (
              <span key={s} className="text-sm bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="prose prose-gray max-w-none mb-10">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{advisor.bio}</p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
          <h2 className="font-semibold text-gray-900 mb-2">Work with {advisor.user?.name?.split(" ")[0] ?? "this advisor"}</h2>
          <p className="text-sm text-gray-500 mb-4">
            Send a connection request. Once accepted, you can ask questions directly and receive their
            insights and market alerts. Advisory fees, if any, are arranged directly with the advisor.
          </p>
          <ConnectButton advisorId={advisor.id} />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

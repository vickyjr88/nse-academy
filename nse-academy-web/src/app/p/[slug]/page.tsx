import { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import InvestorCard from "@/components/InvestorCard";
import Link from "next/link";

interface PublicProfile {
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
  displayName: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  conservative: "Conservative Investor",
  moderate: "Moderate Investor",
  aggressive: "Aggressive Investor",
  growth: "Growth Investor",
  dividend: "Dividend Seeker",
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://nseacademy.vitaldigitalmedia.net";
}

async function fetchProfile(slug: string): Promise<PublicProfile | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/profiler/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicProfile;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await fetchProfile(slug);
  if (!profile) {
    return { title: "Investor Profile Not Found | NSE Academy" };
  }
  const label = TYPE_LABEL[profile.type] ?? "NSE Investor";
  const title = `${profile.displayName} is a ${label} | NSE Academy`;
  const description = `${profile.displayName} took the NSE Academy investor profiler quiz - risk score ${profile.riskScore}/100, ${profile.horizonYears}-year horizon. Discover your own investor type for free.`;
  const url = `${siteUrl()}/p/${slug}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await fetchProfile(slug);
  if (!profile) notFound();

  const label = TYPE_LABEL[profile.type] ?? "NSE Investor";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicHeader />
      <main className="flex-grow pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <p className="text-sm uppercase tracking-wider text-emerald-700 font-semibold mb-2">
              Shared Investor Profile
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              {profile.displayName} is a {label}
            </h1>
            <p className="mt-2 text-gray-500">
              Based on the NSE Academy investor profiler quiz
            </p>
          </div>

          <InvestorCard
            type={profile.type}
            riskScore={profile.riskScore}
            horizonYears={profile.horizonYears}
            capitalRange={profile.capitalRange}
          />

          <div className="mt-10 bg-emerald-700 rounded-2xl p-8 text-center text-white shadow-lg">
            <h2 className="text-2xl font-bold mb-2">What&apos;s your investor type?</h2>
            <p className="text-emerald-100 mb-6 max-w-md mx-auto">
              Take the free 10-question quiz and discover your personalised NSE
              learning path and stock recommendations.
            </p>
            <Link
              href="/investor-profiler"
              className="inline-block bg-white text-emerald-700 font-bold px-8 py-3 rounded-xl hover:bg-emerald-50 transition-colors"
            >
              Take the Quiz →
            </Link>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

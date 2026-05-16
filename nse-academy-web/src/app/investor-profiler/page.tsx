import { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { TrackedLink } from "@/components/TrackedLink";
import LeadMagnetForm from "@/components/LeadMagnetForm";
import { getLeadMagnet } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Investor Profiler Quiz | NSE Academy",
  description: "Discover your true investor type with our free 10-question quiz. Get a personalized learning path and stock recommendations for the Nairobi Securities Exchange.",
  openGraph: {
    title: "Investor Profiler Quiz | NSE Academy",
    description: "Discover your true investor type with our free 10-question quiz.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net'}/investor-profiler`,
  },
};

// See landing page for context — same kill switch.
const LEAD_CAPTURE_ENABLED =
  process.env.NEXT_PUBLIC_LEAD_CAPTURE_ENABLED === "true";

export default async function InvestorProfilerPage() {
  const leadMagnet = LEAD_CAPTURE_ENABLED
    ? await getLeadMagnet("free-chapter")
    : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Investor Profiler Quiz",
    "description": "Discover your true investor type with our free 10-question quiz. Get a personalized learning path and stock recommendations for the Nairobi Securities Exchange.",
    "url": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nseacademy.vitaldigitalmedia.net'}/investor-profiler`,
    "mainEntity": {
      "@type": "SoftwareApplication",
      "name": "NSE Investor Profiler",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "All"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader />

        <main className="flex-grow flex items-center justify-center pt-24 pb-20 px-4 sm:px-6">
          <div className="max-w-3xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-emerald-700 px-8 py-12 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-10"></div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 relative z-10">
                Discover Your Investor Type
              </h1>
              <p className="text-lg text-emerald-100 max-w-xl mx-auto relative z-10">
                Are you Conservative, Moderate, Aggressive, a Dividend Seeker, or a Growth Investor?
              </p>
            </div>
            
            <div className="p-8 sm:p-12">
              <div className="space-y-8 mb-10">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xl font-bold">1</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Answer 10 Questions</h3>
                    <p className="text-gray-600 leading-relaxed">We will assess your risk tolerance, financial goals, time horizon, and current financial situation.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xl font-bold">2</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Get Your Profile</h3>
                    <p className="text-gray-600 leading-relaxed">Instantly discover which of the 5 core investor personas fits your unique profile.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xl font-bold">3</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Unlock Your Path</h3>
                    <p className="text-gray-600 leading-relaxed">Receive a personalized learning roadmap and actionable NSE stock recommendations tailored exactly to your new profile.</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <TrackedLink
                  href="/profile"
                  event="profiler_quiz_started"
                  eventProps={{ location: "profiler_landing" }}
                  className="inline-block bg-emerald-700 text-white text-lg font-bold px-10 py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-lg hover:shadow-xl w-full sm:w-auto"
                >
                  Start the Free Quiz →
                </TrackedLink>
                <p className="mt-4 text-sm text-gray-400">Takes less than 3 minutes. No credit card required.</p>
              </div>
            </div>
          </div>

          {leadMagnet && (
            <div className="max-w-3xl w-full mt-8">
              <LeadMagnetForm
                magnet={leadMagnet}
                source="investor_profiler"
                variant="inline"
              />
            </div>
          )}
        </main>

        <PublicFooter />
      </div>
    </>
  );
}

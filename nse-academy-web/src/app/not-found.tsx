import Link from "next/link";
import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Page Not Found — NSE Academy",
  description:
    "The page you're looking for doesn't exist. Explore NSE Academy's investor tools, courses, and resources.",
};

const navigationCards = [
  {
    icon: "🏠",
    title: "Home",
    description: "Back to the main page — discover your investor type and start your NSE journey.",
    href: "/",
    color: "from-emerald-50 to-teal-50",
    border: "border-emerald-100 hover:border-emerald-300",
    iconBg: "bg-emerald-100",
  },
  {
    icon: "📰",
    title: "Blog & Market News",
    description: "Daily NSE updates, weekly roundups, stock deep dives, and market analysis.",
    href: "/blog",
    color: "from-blue-50 to-indigo-50",
    border: "border-blue-100 hover:border-blue-300",
    iconBg: "bg-blue-100",
  },
  {
    icon: "🏢",
    title: "NSE Companies",
    description: "Browse all 62 NSE-listed companies with live prices, profiles, and sector data.",
    href: "/companies",
    color: "from-violet-50 to-purple-50",
    border: "border-violet-100 hover:border-violet-300",
    iconBg: "bg-violet-100",
  },
  {
    icon: "🧮",
    title: "Investment Calculators",
    description: "Compound interest, dividend yield, and portfolio allocation calculators.",
    href: "/calculators",
    color: "from-amber-50 to-yellow-50",
    border: "border-amber-100 hover:border-amber-300",
    iconBg: "bg-amber-100",
  },
  {
    icon: "📚",
    title: "Learning Courses",
    description: "Structured courses from NSE basics to advanced stock analysis — mapped to your profile.",
    href: "/dashboard/learn",
    color: "from-teal-50 to-cyan-50",
    border: "border-teal-100 hover:border-teal-300",
    iconBg: "bg-teal-100",
  },
  {
    icon: "🎯",
    title: "Investor Profiler",
    description: "Take a 10-question quiz to discover your investor type and get personalized recommendations.",
    href: "/profile",
    color: "from-rose-50 to-pink-50",
    border: "border-rose-100 hover:border-rose-300",
    iconBg: "bg-rose-100",
  },
  {
    icon: "💰",
    title: "Pricing & Plans",
    description: "Compare Free, Intermediary, and Premium tiers. Start free, upgrade when ready.",
    href: "/pricing",
    color: "from-emerald-50 to-green-50",
    border: "border-emerald-100 hover:border-emerald-300",
    iconBg: "bg-emerald-100",
  },
  {
    icon: "📖",
    title: "NSE Glossary",
    description: "Key stock market terms and definitions every Kenyan investor should know.",
    href: "/glossary",
    color: "from-sky-50 to-blue-50",
    border: "border-sky-100 hover:border-sky-300",
    iconBg: "bg-sky-100",
  },
  {
    icon: "❓",
    title: "FAQ",
    description: "Frequently asked questions about NSE Academy, subscriptions, payments, and investing.",
    href: "/faq",
    color: "from-orange-50 to-amber-50",
    border: "border-orange-100 hover:border-orange-300",
    iconBg: "bg-orange-100",
  },
  {
    icon: "📧",
    title: "Contact Us",
    description: "Get in touch with our support team for help, feedback, or partnership enquiries.",
    href: "/contact",
    color: "from-indigo-50 to-violet-50",
    border: "border-indigo-100 hover:border-indigo-300",
    iconBg: "bg-indigo-100",
  },
  {
    icon: "📊",
    title: "Dashboard",
    description: "Access your personalized dashboard — stock advisor, courses, billing, and more.",
    href: "/dashboard",
    color: "from-cyan-50 to-teal-50",
    border: "border-cyan-100 hover:border-cyan-300",
    iconBg: "bg-cyan-100",
  },
  {
    icon: "🔐",
    title: "Sign In",
    description: "Log in to your NSE Academy account to access premium content and tools.",
    href: "/auth/login",
    color: "from-gray-50 to-slate-50",
    border: "border-gray-200 hover:border-gray-400",
    iconBg: "bg-gray-100",
  },
];

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Hero area */}
        <div className="text-center mb-16">
          <div className="relative inline-block mb-8">
            <span className="text-[120px] sm:text-[160px] font-black text-gray-100 leading-none select-none">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-sm border border-gray-100">
                <span className="text-3xl">🧭</span>
              </div>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            This page doesn&apos;t exist
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto mb-2">
            The page you&apos;re looking for may have been moved or removed.
            But don&apos;t worry — there&apos;s plenty to explore.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-emerald-700 font-semibold hover:text-emerald-800 transition-colors mt-4"
          >
            ← Back to home
          </Link>
        </div>

        {/* Navigation cards grid */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 text-center">
            Explore NSE Academy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {navigationCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`group relative bg-gradient-to-br ${card.color} border ${card.border} rounded-2xl p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`${card.iconBg} w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform duration-200`}
                  >
                    {card.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm mb-1 group-hover:text-emerald-700 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                      {card.description}
                    </p>
                  </div>
                </div>
                {/* Hover arrow */}
                <span className="absolute top-5 right-4 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all text-sm">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

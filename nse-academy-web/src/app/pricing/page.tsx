import Link from "next/link";
import { Metadata } from "next";
import PublicFooter from "@/components/PublicFooter";

export const metadata: Metadata = {
  title: "Pricing — NSE Academy",
  description: "Simple, transparent pricing for every Kenyan investor.",
};

const pricingTiers = [
  {
    name: "Free",
    price: "KSh 0",
    period: "",
    features: [
      "Investor profiler quiz",
      "First 3 modules (Getting Started)",
      "NSE glossary access",
      "Basic stock profiles",
    ],
    cta: "Get Started Free",
    href: "/auth/register",
    highlighted: false,
    badge: null,
  },
  {
    name: "Intermediary",
    price: "KSh 100",
    period: "/month",
    features: [
      "Everything in Free",
      "NSE Complete Trading Guide course",
      "62 NSE-listed companies deep dive",
      "Stockbroker comparison module",
      "Market indices & strategies",
      "NSE Complete Trading Guide PDF",
    ],
    cta: "Start Intermediary",
    href: "/auth/register?plan=intermediary",
    highlighted: false,
    badge: "Most Popular",
  },
  {
    name: "Premium",
    price: "KSh 500",
    period: "/month",
    features: [
      "Everything in Intermediary",
      "Full 13-chapter Investor's Guide academy",
      "Personalized stock advisor",
      "Portfolio building tools",
      "NSE Complete Investor's Guide PDF",
      "Priority support",
    ],
    cta: "Start Premium",
    href: "/auth/register?plan=premium",
    highlighted: true,
    badge: null,
  },
];

const corporatePlans = [
  { name: "Starter", seats: 5, price: "KSh 1,500", period: "/month", tagline: "Perfect for small teams", plan: "starter" },
  { name: "Team", seats: 15, price: "KSh 3,500", period: "/month", tagline: "Ideal for departments", plan: "team", badge: "Most Popular" },
  { name: "SACCO", seats: 50, price: "KSh 10,000", period: "/month", tagline: "Built for SACCOs & large orgs", plan: "sacco" },
];

const corporateFeatures = [
  "All Premium features",
  "Admin dashboard",
  "Member management & invites",
  "Priority support",
  "Custom onboarding call",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 h-16 shrink-0">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-emerald-700">
            NSE Academy
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/auth/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Log in</Link>
            <Link href="/auth/register" className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors">Register</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h1>
            <p className="text-gray-500 max-w-xl mx-auto">
              Start free. Upgrade when you're ready to go deeper into the Nairobi Securities Exchange.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-2xl p-8 border ${
                  tier.highlighted
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-lg"
                    : "border-gray-200 bg-white"
                }`}
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                    {tier.badge}
                  </span>
                )}
                <h3 className={`font-bold text-xl mb-1 ${tier.highlighted ? "text-white" : "text-gray-900"}`}>
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-bold ${tier.highlighted ? "text-white" : "text-gray-900"}`}>
                    {tier.price}
                  </span>
                  <span className={tier.highlighted ? "text-emerald-200" : "text-gray-400"}>
                    {tier.period}
                  </span>
                </div>
                <ul className="space-y-4 mb-10">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm">
                      <span className={tier.highlighted ? "text-emerald-300" : "text-emerald-600"}>✓</span>
                      <span className={tier.highlighted ? "text-emerald-50" : "text-gray-600"}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`block text-center font-bold py-3.5 rounded-xl transition-all ${
                    tier.highlighted
                      ? "bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm"
                      : "bg-emerald-700 text-white hover:bg-emerald-800"
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-20">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">For Companies & SACCOs</h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Give your whole team access to NSE Academy. Seat-based pricing with a dedicated admin dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {corporatePlans.map((plan) => (
                <div
                  key={plan.plan}
                  className="relative rounded-2xl p-8 border border-indigo-200 bg-white"
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                  <div className="text-3xl mb-3">🏢</div>
                  <h3 className="font-bold text-xl mb-1 text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-indigo-700 mb-3">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">{plan.seats} seats included</p>
                  <ul className="space-y-3 mb-8">
                    {corporateFeatures.map((feat) => (
                      <li key={feat} className="flex items-start gap-3 text-sm">
                        <span className="text-indigo-600">✓</span>
                        <span className="text-gray-600">{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/auth/register/corporate?plan=${plan.plan}`}
                    className="block text-center font-bold py-3.5 rounded-xl bg-indigo-700 text-white hover:bg-indigo-800 transition-all"
                  >
                    Get Started →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

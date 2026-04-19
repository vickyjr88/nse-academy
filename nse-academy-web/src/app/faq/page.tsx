import Link from "next/link";
import type { Metadata } from "next";
import FaqClient, { type FaqCategory } from "./FaqClient";

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "FAQ — NSE Academy | Frequently Asked Questions",
  description:
    "Answers to your questions about NSE Academy — investor profiling, courses, pricing, stock advisor, calculators, and how to start investing on the Nairobi Securities Exchange.",
  openGraph: {
    title: "NSE Academy FAQ — Everything You Need to Know",
    description: "Comprehensive answers about NSE Academy, pricing, investor profiling, courses, and Nairobi Stock Exchange investing.",
    type: "website",
    url: "https://nseacademy.vitaldigitalmedia.net/faq",
    siteName: "NSE Academy",
  },
  twitter: { card: "summary", title: "NSE Academy FAQ", description: "Answers to all your questions about NSE Academy." },
  alternates: { canonical: "https://nseacademy.vitaldigitalmedia.net/faq" },
};

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------

const CATEGORIES: FaqCategory[] = [
  {
    id: "about",
    label: "About NSE Academy",
    icon: "🎓",
    items: [
      {
        q: "What is NSE Academy?",
        a: "NSE Academy is a personalized investor education platform built specifically for Kenyan investors who want to participate in the Nairobi Securities Exchange (NSE). We help you discover your investor type through a profiling quiz, then give you a tailored learning path, stock recommendations, and tools — all designed around how you invest, not a generic template.",
      },
      {
        q: "Who is NSE Academy for?",
        a: "NSE Academy is for anyone interested in investing on the Nairobi Securities Exchange — whether you are a complete beginner who has never bought a share, an intermediate investor wanting to deepen your knowledge, or an experienced investor looking for a structured framework and research tools. We have content and tools for all levels.",
      },
      {
        q: "Is NSE Academy officially affiliated with the Nairobi Securities Exchange?",
        a: "No. NSE Academy is an independent investor education platform built by Infinity Digital Works. We are not affiliated with, endorsed by, or officially connected to the Nairobi Securities Exchange (NSE) or the Capital Markets Authority (CMA). All content is educational and for informational purposes only.",
      },
      {
        q: "How is NSE Academy different from the official NSE Academy at academy.nse.co.ke?",
        a: "The official NSE Academy (academy.nse.co.ke) is primarily a paper trading simulator. Our platform goes further: we profile your investor type, give you personalised learning paths matched to your risk tolerance and goals, provide a company research tool showing which stocks fit your specific profile, and publish ongoing market analysis and roundups. Think of us as your NSE investing coach, not just a simulator.",
      },
      {
        q: "Is my personal and financial data safe?",
        a: "Yes. We do not store any of your actual bank or brokerage account details. Your quiz responses and investor profile are stored securely in our database. Payments are processed entirely by Paystack — a PCI-DSS compliant payment processor — and we never see your card details. We do not sell your data to third parties.",
      },
    ],
  },
  {
    id: "profiler",
    label: "Investor Profiler",
    icon: "🎯",
    items: [
      {
        q: "What is the Investor Profiler quiz?",
        a: "The Investor Profiler is a 10-question quiz that determines your investor type based on your risk tolerance, investment time horizon, capital range, goals, and reaction to market volatility. It takes about 3–5 minutes to complete and is available free to all registered users.",
      },
      {
        q: "What are the investor types and what do they mean?",
        a: `NSE Academy identifies five investor types:

• Conservative — You prioritise capital preservation above all else. Low-risk, dividend-paying stocks and bonds suit you best. You cannot stomach large losses.

• Moderate — You want a balance between growth and income. You accept some volatility in exchange for better long-term returns.

• Aggressive — You are focused on maximum capital appreciation and accept significant short-term swings. Long time horizon, high risk tolerance.

• Dividend Seeker — Your primary goal is passive income through regular dividend payments. You focus on dividend yield, payout ratios, and consistency.

• Growth Investor — You target companies with strong earnings growth potential. Capital appreciation over income. You often invest in emerging sectors and leaders.`,
      },
      {
        q: "Can I retake the profiler quiz?",
        a: "Yes. You can retake the investor profiler as many times as you like from your Dashboard. Your most recent result will be used to update your stock recommendations and course learning path. Investor profiles naturally evolve as your financial situation and goals change.",
      },
      {
        q: "How does my investor type affect what I see on the platform?",
        a: "Your investor type drives three things: (1) your personalised course learning path — conservative investors see bond and dividend content first, while aggressive investors are directed toward growth and analysis modules; (2) your stock recommendations on the Stock Advisor page; and (3) your personal fit score in the Company Research tool, which shows how well any specific NSE company matches your profile.",
      },
    ],
  },
  {
    id: "courses",
    label: "Courses & Content",
    icon: "📚",
    items: [
      {
        q: "What courses are available on NSE Academy?",
        a: `We currently have two full courses:

1. NSE Complete Trading Guide (Intermediary tier) — 7 chapters covering stock trading basics, step-by-step account opening, all 62 NSE-listed companies by sector, licensed stockbrokers, NSE market indices, investment strategies, and top dividend stocks.

2. NSE Complete Investor's Guide (Premium tier) — 13 chapters covering everything from NSE fundamentals to fundamental analysis, technical analysis, taxation, bonds, IPOs, three model portfolios, risk management, and detailed company profiles.

Free users get access to the first 3 modules of the Investor's Guide covering NSE basics and account opening.`,
      },
      {
        q: "What chapters are available for free?",
        a: "Free users can access: Introduction (Why Invest in the NSE), Chapter 1 (Understanding Stock Trading Basics), and Chapter 2 (Getting Started — Your Step-by-Step Guide). This gives you a solid foundation before deciding whether to upgrade.",
      },
      {
        q: "How does the learning path work?",
        a: "After completing the Investor Profiler, your dashboard shows a recommended learning path ordered by relevance to your investor type. You can follow this path or explore all available modules freely. The system tracks which lessons you have completed so you can pick up where you left off.",
      },
      {
        q: "Can I download the course content or ebooks?",
        a: "Intermediary subscribers can download the NSE Complete Trading Guide as a PDF. Premium subscribers can download both the NSE Complete Trading Guide and the NSE Complete Investor's Guide as PDFs. Free users cannot download PDFs but can access free lessons online.",
      },
      {
        q: "How often is new content added?",
        a: "Course content is updated periodically to reflect current NSE regulations, market conditions, and company data. Blog articles (news, weekly roundups, market analysis) are published regularly. Subscribe to our RSS feed or newsletter to be notified of new content.",
      },
      {
        q: "Is the NSE Glossary available for free?",
        a: "Yes. The full NSE Glossary — covering 200+ Kenyan capital markets terms — is available to all users including free accounts. You can search alphabetically or by keyword from the Glossary page.",
      },
    ],
  },
  {
    id: "pricing",
    label: "Pricing & Subscriptions",
    icon: "💳",
    items: [
      {
        q: "What are the subscription tiers?",
        a: `NSE Academy has three tiers:

Free (KSh 0) — Investor profiler quiz, first 3 course modules, NSE glossary, basic stock profiles. No credit card required.

Intermediary (KSh 100/month) — Everything in Free plus the full NSE Complete Trading Guide course (7 chapters, all 62 companies, brokers, strategies), Trading Guide PDF download.

Premium (KSh 500/month) — Everything in Intermediary plus the full 13-chapter NSE Investor's Guide, personalized stock advisor, company research tool, both ebook PDFs, and priority support.`,
      },
      {
        q: "How do I pay? What payment methods are accepted?",
        a: "Payments are processed by Paystack, Kenya's leading payment processor. You can pay using M-Pesa, Visa, Mastercard, or bank transfer. All transactions are secure and PCI-DSS compliant. You will be redirected to the Paystack payment page when upgrading.",
      },
      {
        q: "Is this a monthly subscription? Can I cancel?",
        a: "Yes, subscriptions are monthly and you can cancel at any time. Your access continues until the end of your paid period. We do not offer refunds for partial months, but there is no lock-in — cancel with one click from your Account settings.",
      },
      {
        q: "Is there an annual plan?",
        a: "Annual plans are on our roadmap. Currently only monthly subscriptions are available. Sign up for our newsletter or follow the blog to be notified when annual pricing is introduced.",
      },
      {
        q: "Can I upgrade from Intermediary to Premium?",
        a: "Yes. From your Dashboard → Subscription page, you will see an upgrade button to move from Intermediary to Premium for KSh 500/month. Your access upgrades immediately after payment is confirmed.",
      },
      {
        q: "Do you offer student or group discounts?",
        a: "We are working on group pricing for investment clubs and educational institutions. If you run an investment club or SACCO and are interested in a group subscription, contact us at hello@nseacademy.vitaldigitalmedia.net and we will work something out.",
      },
    ],
  },
  {
    id: "advisor",
    label: "Stock Advisor & Research",
    icon: "📈",
    items: [
      {
        q: "How does the Stock Advisor work?",
        a: "The Stock Advisor analyses your investor type and risk score, then pulls matching companies from our database of NSE-listed stock profiles. Conservative investors are matched with low-risk, dividend-paying stocks; aggressive and growth investors see higher-risk, high-growth opportunities; dividend seekers see stocks ranked by yield. The top 15 matches are shown on your Stock Advisor page.",
      },
      {
        q: "Are the stock recommendations financial advice?",
        a: "No. Stock recommendations on NSE Academy are for educational and research purposes only. They are generated by an algorithm based on your investor profile and publicly available company data — not by a licensed financial advisor. Always conduct your own research and consult a licensed investment professional before making any investment decisions.",
      },
      {
        q: "What is the Company Research Tool?",
        a: "The Company Research Tool (Premium only) lets you search for any NSE-listed company by name or ticker and see a full investor-type fit analysis. It shows: which of the 5 investor types the stock is best suited for (rated Excellent / Good / Neutral / Caution), the reasons behind each rating, and a personal fit score (0–100) based on your own investor profile.",
      },
      {
        q: "How are the fit scores calculated?",
        a: "Fit scores are calculated based on: risk level (low/medium/high), dividend yield, sector stability, and whether the company is tagged as suitable for a given investor type in our database. Scores above 70 are a strong match, 50–70 is a reasonable fit, and below 50 suggests the company may not align well with your investing style.",
      },
      {
        q: "How current is the stock data?",
        a: "Stock profiles (sector, risk level, dividend yield) are updated periodically based on published annual reports and NSE data. Real-time price data is not currently available. For live prices, use your broker's platform or nse.co.ke. We plan to add live price feeds in a future update.",
      },
      {
        q: "How many NSE companies are covered?",
        a: "Our database covers all 62 NSE-listed companies across 11 sectors: Agricultural, Banking, Commercial & Services, Construction & Allied, Energy & Petroleum, Insurance, Investment, Investment Services, Manufacturing & Allied, Telecommunications, and REITs.",
      },
    ],
  },
  {
    id: "calculators",
    label: "Calculators",
    icon: "🧮",
    items: [
      {
        q: "What calculators are available?",
        a: `NSE Academy offers 5 free calculators at /calculators:

• Broker Fee Estimator — See the exact breakdown of NSE transaction costs (brokerage, CDS fee, NSE levy, CMA levy) for any trade value.

• Dividend Yield Calculator — Calculate dividend yield, annual income, and monthly income for any NSE stock.

• Compound Growth Calculator — Project how your NSE investments grow over time with optional monthly contributions and year-by-year milestones.

• DCA Calculator — Model a dollar-cost averaging strategy and compare it to a lump sum investment.

• Dividend Income Target — Calculate exactly how many shares and how much capital you need to reach a target monthly passive income.`,
      },
      {
        q: "What are the actual NSE transaction costs when buying shares?",
        a: `When you buy or sell NSE shares, you pay:

• Brokerage commission: approximately 1.5–2.1% (varies by broker)
• CDS fee: 0.12%
• NSE levy: 0.12%
• CMA levy: 0.06%

Total: approximately 1.8–2.4% of the trade value. Use our Broker Fee Estimator for the exact figures on any trade amount.`,
      },
      {
        q: "Are the calculator results guaranteed to be accurate?",
        a: "Calculators use standard financial formulas and publicly known NSE fee schedules. Results are estimates for planning purposes only. Actual broker fees may vary slightly — always confirm with your specific broker. Investment returns are hypothetical; past NSE performance does not guarantee future results.",
      },
    ],
  },
  {
    id: "blog",
    label: "Blog & Newsletter",
    icon: "📰",
    items: [
      {
        q: "What does the NSE Academy blog cover?",
        a: "The blog publishes content across 7 categories: NSE News (breaking market news), Daily Update (daily market snapshot), Weekly Roundup (weekly performance summary), Market Analysis (in-depth sector and stock analysis), Stock Deep Dive (single-company deep dives), IPO Watch (upcoming and recent IPOs), and Investor Education (educational long-reads).",
      },
      {
        q: "Is the blog content free?",
        a: "Yes. All blog articles are publicly available — no account or subscription required. We believe an informed investor community benefits everyone. Share any article freely.",
      },
      {
        q: "How do I get notified of new articles?",
        a: "You can subscribe to our RSS feed at /blog/rss.xml and add it to any RSS reader. Email newsletter notifications are on our roadmap — follow the blog for updates.",
      },
      {
        q: "Can I submit a guest article or market analysis?",
        a: "We welcome contributions from experienced NSE investors, analysts, and finance professionals. Email us at hello@nseacademy.vitaldigitalmedia.net with your proposed topic and a brief bio. All submissions are reviewed before publication.",
      },
    ],
  },
  {
    id: "account",
    label: "Account & Technical",
    icon: "⚙️",
    items: [
      {
        q: "How do I create an account?",
        a: "Click 'Get started' on any page and fill in your name, email address, and a password. You will receive a verification email. After verifying, you can log in and take the investor profiler quiz immediately. Registration is free and no credit card is required.",
      },
      {
        q: "I forgot my password. How do I reset it?",
        a: "On the login page, click 'Forgot password' and enter your registered email address. You will receive a reset link valid for 1 hour. If you do not receive it, check your spam folder. If the problem persists, contact support at hello@nseacademy.vitaldigitalmedia.net.",
      },
      {
        q: "Can I change my email address?",
        a: "Yes. Go to Dashboard → Account Settings to update your email address. You will need to verify the new address before the change takes effect.",
      },
      {
        q: "Is there a mobile app?",
        a: "Not yet. NSE Academy is currently a web application optimised for both desktop and mobile browsers. A native mobile app for Android and iOS is on our product roadmap. In the meantime, you can add the website to your phone's home screen for an app-like experience.",
      },
      {
        q: "What browsers are supported?",
        a: "NSE Academy works on all modern browsers including Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated to the latest version for the best experience. Internet Explorer is not supported.",
      },
      {
        q: "How do I cancel my subscription?",
        a: "Go to Dashboard → Subscription. You will see a cancel option. Cancellation takes effect at the end of your current billing period — you retain full access until then. Your data and course progress are preserved if you choose to resubscribe.",
      },
      {
        q: "How do I delete my account?",
        a: "To permanently delete your account and all associated data, email hello@nseacademy.vitaldigitalmedia.net from your registered email address with the subject line 'Account Deletion Request'. We will process the request within 7 business days in accordance with data protection regulations.",
      },
    ],
  },
  {
    id: "nse",
    label: "NSE Investing Basics",
    icon: "🏦",
    items: [
      {
        q: "What is the Nairobi Securities Exchange (NSE)?",
        a: "The Nairobi Securities Exchange is Kenya's principal stock exchange, established in 1954. It lists 62 companies across 11 sectors with a market capitalisation of approximately KSh 2.9 trillion as of early 2026. The NSE is regulated by the Capital Markets Authority (CMA) and operates Monday to Friday from 9:00 AM to 3:00 PM EAT.",
      },
      {
        q: "How do I start buying shares on the NSE?",
        a: `To buy NSE shares you need to:

1. Get a KRA PIN (free at itax.kra.go.ke)
2. Open a CDS (Central Depository System) account through a licensed stockbroker
3. Register with and fund your broker account
4. Research stocks and place orders through your broker's platform

Our Intermediary course covers this step-by-step. Free users can access Chapters 1–3 which walk through the entire process.`,
      },
      {
        q: "How much money do I need to start investing on the NSE?",
        a: "Since August 2025, single-share trading is allowed on the NSE, meaning you can buy as little as one share. Depending on the stock, a single share can cost between KSh 1 and KSh 40+. Practically, brokers recommend starting with at least KSh 5,000–10,000 to keep transaction costs (approximately 2%) proportionate.",
      },
      {
        q: "What is a CDS account and do I need one?",
        a: "A CDS (Central Depository System) account is a mandatory electronic account where your NSE shares are held. It is opened automatically when you register with a stockbroker. Every NSE investor must have a CDS account — shares are not held in paper form. Your CDS account number is unique to you and your shares remain safe even if your broker closes down.",
      },
      {
        q: "How are NSE share prices determined?",
        a: "NSE share prices are determined by supply and demand — the price at which a willing buyer and seller agree to transact. Prices fluctuate throughout the trading day (9:00 AM–3:00 PM EAT). Factors that influence prices include company earnings, dividends, economic news, sector trends, and overall market sentiment.",
      },
      {
        q: "What is the settlement period on the NSE?",
        a: "The NSE operates on a T+3 settlement cycle — trades settle three business days after the transaction date. This means if you buy shares on Monday, the shares appear in your CDS account and payment is debited by Thursday.",
      },
      {
        q: "What taxes do I pay on NSE investments?",
        a: `NSE-related taxes in Kenya:

• Capital Gains Tax (CGT): 15% on profits when you sell shares (introduced in 2023).
• Withholding Tax on Dividends: 5% for Kenyan residents, 10% for non-residents — deducted automatically before dividends are paid to you.
• No wealth tax or annual holding tax on shares.

Our Premium course (Chapter 8) covers NSE taxation in full detail.`,
      },
      {
        q: "What is the NSE 20-Share Index?",
        a: "The NSE 20-Share Index tracks the performance of the top 20 blue-chip companies listed on the NSE, selected based on market capitalisation, liquidity, and financial performance. It is the oldest NSE index (base value: 100 in 1964) and is the most widely quoted indicator of large-cap market performance in Kenya.",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// JSON-LD — all Q&As for Google rich results
// ---------------------------------------------------------------------------

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CATEGORIES.flatMap((cat) =>
    cat.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FaqPage() {
  const totalQuestions = CATEGORIES.reduce((acc, c) => acc + c.items.length, 0);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50">
        {/* Nav */}
        <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-bold text-xl text-emerald-700">NSE Academy</Link>
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
              <Link href="/blog" className="hover:text-gray-900">Blog</Link>
              <Link href="/calculators" className="hover:text-gray-900">Calculators</Link>
              <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">Log in</Link>
              <Link href="/auth/register" className="text-sm bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors">
                Get started
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <div className="bg-white border-b border-gray-100 py-14 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h1>
            <p className="text-gray-500 text-lg">
              {totalQuestions} answers across {CATEGORIES.length} topics — search or browse by category.
            </p>
          </div>
        </div>

        {/* Sticky jump nav (desktop) */}
        <div className="hidden lg:block sticky top-16 z-10 bg-white/90 backdrop-blur border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-6 py-3 flex flex-wrap gap-x-6 gap-y-1">
            {CATEGORIES.map((cat) => (
              <a
                key={cat.id}
                href={`#${cat.id}`}
                className="text-xs text-gray-500 hover:text-emerald-700 transition-colors"
              >
                {cat.icon} {cat.label}
              </a>
            ))}
          </div>
        </div>

        {/* FAQ content (client for search/accordion) */}
        <FaqClient categories={CATEGORIES} />

        {/* Still have questions CTA */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
          <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Still have a question?</h2>
            <p className="text-gray-500 mb-6">
              We're here to help. Reach out and we'll get back to you as soon as possible.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:hello@nseacademy.vitaldigitalmedia.net"
                className="inline-block bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors text-sm"
              >
                Email Support →
              </a>
              <Link
                href="/auth/register"
                className="inline-block border border-gray-200 text-gray-700 font-medium px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Create a free account
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-100 bg-white py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-400">
            <span>© 2026 NSE Academy — Empowering Kenyan Investors</span>
            <div className="flex gap-4">
              <Link href="/blog" className="hover:text-gray-600">Blog</Link>
              <Link href="/calculators" className="hover:text-gray-600">Calculators</Link>
              <Link href="/pricing" className="hover:text-gray-600">Pricing</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

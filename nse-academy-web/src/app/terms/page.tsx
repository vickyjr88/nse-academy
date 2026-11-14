import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Terms of Service - NSE Academy",
  description:
    "The terms for using the NSE Academy website and mobile app: accounts, plans and payment, acceptable use, educational content and liability.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "NSE Academy Terms of Service", url: "/terms", type: "website", siteName: SITE_NAME },
};

const CONTACT = "info@vitaldigitalmedia.net";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold mt-12 mb-4 border-l-4 border-emerald-600 pl-4">{children}</h2>;
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <PublicHeader />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-gray-600 leading-relaxed">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-gray-900">Terms of Service</h1>
          <p className="text-sm text-gray-400 mb-8">Effective 15 November 2026</p>

          <p className="mb-4">
            These terms govern your use of the NSE Academy website (nseacademy.vitaldigitalmedia.net) and the NSE
            Academy mobile app. NSE Academy is run by Infinity Digital Works (&ldquo;we&rdquo;, &ldquo;us&rdquo;), Nairobi,
            Kenya. By creating an account or using the service you agree to them. If you do not agree, please do not use
            it. How we handle personal data is set out in our{" "}
            <Link href="/privacy" className="text-emerald-700 hover:underline">Privacy Policy</Link>.
          </p>

          <H2>Education only, not investment advice</H2>
          <p>
            Everything on NSE Academy &mdash; articles, courses, calculators, model portfolios, market reports, prices and
            company profiles &mdash; is for education and information. We are not a licensed investment adviser, broker,
            or stockbroker, and we are not affiliated with the Nairobi Securities Exchange or the Capital Markets
            Authority. Nothing here is a recommendation to buy, sell or hold any security. Investments can fall as well as
            rise, and you can lose money. Make your own decisions, or speak to a licensed professional.
          </p>

          <H2>Prices and data</H2>
          <p>
            Prices are delayed and market data is compiled from public sources. It may be late, incomplete or wrong.
            Calculators give estimates based on the inputs you provide and published fee schedules. Do not rely on any of
            it for a trade without checking with your broker or the NSE.
          </p>

          <H2>Your account</H2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must be 18 or older to create an account.</li>
            <li>Give accurate details and keep your password private. You are responsible for activity on your account.</li>
            <li>One person per account, unless you have a team or organisation plan that includes more seats.</li>
            <li>
              You can delete your account at any time; see{" "}
              <Link href="/delete-account" className="text-emerald-700 hover:underline">delete your account</Link>.
            </li>
          </ul>

          <H2>Plans and payment</H2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Some content is free. Paid plans (for example Intermediary and Premium) unlock more courses and tools, as described on the <Link href="/pricing" className="text-emerald-700 hover:underline">pricing page</Link>.</li>
            <li>
              On the website, a paid plan is paid for in advance for the period you choose (1, 3, 6 or 12 months) in Kenyan
              shillings through our payment processor, Paystack, by M-Pesa or card. It does not renew by itself.
            </li>
            <li>
              In the Android app, a paid plan is a subscription bought through Google Play. Google Play charges your Google
              account at the price shown when you subscribe, and the subscription renews automatically for the same period
              until you cancel it in Google Play (Payments &amp; subscriptions, then Subscriptions). Cancelling stops the next
              renewal; you keep access until the end of the period you have paid for. Deleting the app or your NSE Academy
              account does not cancel a Google Play subscription, so cancel it in Google Play first.
            </li>
            <li>
              A plan works wherever you sign in with your account, on the website and in the app. If you pay for the same
              plan in both places you are paying twice, so choose one.
            </li>
            <li>
              We do not refund partial periods. If you were charged in error, write to us within 14 days and we will put
              it right. For a subscription bought in the app, refunds are handled by Google Play under its refund policy, and
              we will help where we can.
            </li>
            <li>We may change prices or plan contents. A change does not affect a period you have already paid for, and we will tell you before it applies to your next one.</li>
            <li>Ebooks and other one-off purchases are for your personal use and are delivered as described at checkout.</li>
          </ul>

          <H2>Acceptable use</H2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>copy, resell, republish or scrape our content, or share paid content or your login with people outside your plan;</li>
            <li>attempt to break, overload or bypass the security or access limits of the service;</li>
            <li>use the service to mislead others, or to promote or run investment schemes;</li>
            <li>break the law, or interfere with others&rsquo; use of the service.</li>
          </ul>
          <p className="mt-4">
            We may suspend or close an account that breaks these terms. We will explain why where we can.
          </p>

          <H2>Our content</H2>
          <p>
            The courses, articles, graphics and software are ours or our licensors&rsquo; and are protected by copyright.
            You may read and use them for your own learning. Stock names and tickers belong to their respective companies.
          </p>

          <H2>Availability and changes</H2>
          <p>
            We work to keep the service running but do not promise it will always be available or error-free. We may
            change, add or remove features and content. We may update these terms; when we do we will change the date above
            and tell account holders by email if the change is significant. Using the service after a change means you
            accept it.
          </p>

          <H2>Liability</H2>
          <p>
            The service is provided &ldquo;as is&rdquo;. To the fullest extent the law allows, we are not liable for
            investment losses or other indirect or consequential losses arising from your use of the service or reliance on
            its content. Our total liability to you for any claim is limited to the amount you paid us in the three months
            before it arose. Nothing in these terms limits a right you have under Kenyan consumer law, or liability that
            cannot lawfully be limited.
          </p>

          <H2>Governing law</H2>
          <p>These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction.</p>

          <H2>Contact</H2>
          <p>
            Infinity Digital Works, Nairobi, Kenya.{" "}
            <a href={`mailto:${CONTACT}`} className="text-emerald-700 hover:underline">{CONTACT}</a>, or the{" "}
            <Link href="/contact" className="text-emerald-700 hover:underline">contact form</Link>.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

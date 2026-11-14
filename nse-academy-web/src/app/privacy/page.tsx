import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy - NSE Academy",
  description:
    "What personal data the NSE Academy website and mobile app collect, why, who we share it with, how long we keep it, and how to access or delete it.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "NSE Academy Privacy Policy", url: "/privacy", type: "website", siteName: SITE_NAME },
};

const CONTACT = "info@vitaldigitalmedia.net";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold mt-12 mb-4 border-l-4 border-emerald-600 pl-4">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <PublicHeader />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-gray-600 leading-relaxed">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3 text-gray-900">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mb-8">Effective 14 November 2026</p>

          <p className="mb-4">
            This policy covers the NSE Academy website (nseacademy.vitaldigitalmedia.net) and the NSE Academy mobile app
            for Android. NSE Academy is built and run by Infinity Digital Works (&ldquo;we&rdquo;, &ldquo;us&rdquo;), a
            Nairobi-based company, and we are the controller of the personal data described here. We handle it in line
            with the Kenya Data Protection Act, 2019.
          </p>
          <p>
            The short version: you can read the courses, glossary, company profiles and prices in the mobile app without
            an account, and without giving us any personal data. If you create an account we keep the details needed to
            run it. We do not sell personal data and we do not show third-party advertising.
          </p>

          <H2>What we collect</H2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-gray-800">Account details.</strong> Your name, email address and password (stored
              only as a one-way hash, never in readable form), and your phone number if you choose to give one.
            </li>
            <li>
              <strong className="text-gray-800">Plan and payment status.</strong> Which plan you are on and its dates.
              Card and mobile-money details are entered with our payment processor, Paystack, and never reach our servers.
              We keep the reference and amount of each payment.
            </li>
            <li>
              <strong className="text-gray-800">Things you create in your account.</strong> Investor-profile quiz answers
              and result, lesson progress and, if your plan includes the portfolio journal, the trades, holdings,
              dividends, target weights and price alerts you enter, plus any connection you make to a financial adviser on
              the platform. This is the same whether you use the website or the mobile app, because both use your account.
            </li>
            <li>
              <strong className="text-gray-800">CDS statements you import.</strong> If you upload a CDS statement (PDF) to
              seed your portfolio, we read the holdings from it and keep those holdings, the statement&rsquo;s CDS account
              number, period and file name. We do not keep the PDF itself.
            </li>
            <li>
              <strong className="text-gray-800">Service records.</strong> When you last signed in or used the service, the
              notifications and emails we sent you and whether they were delivered, and, on the website, the campaign or
              referral link you arrived from.
            </li>
            <li>
              <strong className="text-gray-800">On your phone.</strong> The mobile app keeps your reading progress,
              bookmarks, daily-quiz answers and display settings on your device, and they are not sent to us. If you sign
              in, a session token is kept in the phone&rsquo;s secure storage until you sign out. What you create in your
              account (above) is stored on our servers so it is there when you sign in on another device.
            </li>
          </ul>
          <p className="mt-4">
            The mobile app asks for no device permissions beyond internet access. When you choose to import a CDS statement,
            Android shows its own file chooser and the app receives only the file you pick. It does not use your location,
            contacts, camera, microphone or advertising ID, and it has no advertising or analytics software in it. Like
            any internet service, our servers see your IP address and the app version when the app requests content, and
            keep routine technical logs for security and fault-finding.
          </p>

          <H2>Why we use it</H2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide your account, plan and learning progress, and to sign you in.</li>
            <li>To take payment and keep the records the law requires.</li>
            <li>
              To send service messages: receipts, password resets and, for members whose plan includes them, the portfolio
              and price alerts you turned on.
            </li>
            <li>
              To send the evening market digest and learning emails. The digest is off until you switch it on, and every
              email has an unsubscribe link.
            </li>
            <li>To keep the service secure, prevent abuse and fix faults.</li>
          </ul>

          <H2>Who we share it with</H2>
          <p className="mb-3">
            Only service providers that process data for us, and only what they need:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Paystack, to process payments.</li>
            <li>Brevo, to deliver email. We keep a suppression list so we stop writing to addresses that bounce or unsubscribe.</li>
            <li>Our hosting provider, where the database and servers run.</li>
            <li>
              On the website only, Google Analytics, which measures visits in aggregate. The mobile app does not use it.
            </li>
          </ul>
          <p className="mt-4">
            A financial adviser on the platform sees your details only if you connect to them. We disclose data to
            authorities only where the law requires it. We do not sell personal data.
          </p>

          <H2>How long we keep it</H2>
          <p>
            For as long as your account is open. When you delete your account we delete or anonymise your personal data.
            We keep payment records for as long as tax and accounting law requires, and routine backups age out on their
            normal rotation. Email addresses on the suppression list are kept so that we do not email someone who asked us
            to stop.
          </p>

          <H2>Your rights</H2>
          <p className="mb-3">
            You can ask to see the data we hold about you, correct it, delete it, object to how we use it, or receive a
            copy. To delete your account and data, follow the steps on the{" "}
            <Link href="/delete-account" className="text-emerald-700 hover:underline">delete your account</Link> page. For
            anything else, write to{" "}
            <a href={`mailto:${CONTACT}`} className="text-emerald-700 hover:underline">{CONTACT}</a> from the address on
            your account. If you are not satisfied with our answer you may complain to the Office of the Data Protection
            Commissioner of Kenya.
          </p>

          <H2>Security</H2>
          <p>
            Connections to the website, the app and our servers are encrypted in transit, passwords are hashed, and
            access to the database is limited to the people who run the service. No system is perfectly secure; if a
            breach affects your data we will tell you and the regulator as the law requires.
          </p>

          <H2>Children</H2>
          <p>
            NSE Academy is for adults. Investing on the NSE requires a person to be 18 or older, and we do not knowingly
            collect data from children. If you think a child has given us data, tell us and we will remove it.
          </p>

          <H2>Changes</H2>
          <p>
            If we change this policy we will update the date above, and tell account holders by email when the change
            is significant.
          </p>

          <H2>Not investment advice</H2>
          <p>
            Everything in NSE Academy is for education and information. We are not a licensed investment adviser, broker
            or the Nairobi Securities Exchange. See{" "}
            <Link href="/about" className="text-emerald-700 hover:underline">About</Link> for what we are and are not.
          </p>

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

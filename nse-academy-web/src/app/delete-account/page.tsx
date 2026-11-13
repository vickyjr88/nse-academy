import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Delete Your NSE Academy Account and Data",
  description: "How to ask us to delete your NSE Academy account and personal data, what is deleted, and what we must keep.",
  alternates: { canonical: "/delete-account" },
  openGraph: { title: "Delete your NSE Academy account", url: "/delete-account", type: "website", siteName: SITE_NAME },
};

const CONTACT = "info@vitaldigitalmedia.net";
const SUBJECT = encodeURIComponent("Delete my NSE Academy account");
const BODY = encodeURIComponent(
  "Please delete my NSE Academy account and the personal data linked to it.\n\nAccount email: (the address you sign in with)\n",
);

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <PublicHeader />
      <main className="flex-grow pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-gray-600 leading-relaxed">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-gray-900">Delete your NSE Academy account</h1>
          <p className="mb-8">
            This applies to your account on the NSE Academy website and mobile app. You do not need an account to use the
            free parts of the app, so if you never signed in there is nothing to delete on our side. The app keeps reading
            progress and bookmarks only on your phone, and uninstalling the app removes them.
          </p>

          <h2 className="text-2xl font-bold mb-4 border-l-4 border-emerald-600 pl-4">How to ask</h2>
          <ol className="list-decimal pl-6 space-y-2 mb-6">
            <li>
              Email{" "}
              <a href={`mailto:${CONTACT}?subject=${SUBJECT}&body=${BODY}`} className="text-emerald-700 hover:underline">{CONTACT}</a>{" "}
              from the address you sign in with, with the subject &ldquo;Delete my NSE Academy account&rdquo;.
            </li>
            <li>
              We may reply to confirm it is really you. We will not ask for your password.
            </li>
            <li>We delete the account and tell you when it is done.</li>
          </ol>
          <p className="mb-10">
            If you pay for a plan, deleting the account ends it: nothing further is charged, and a paid period already
            used is not refunded unless the law says so. If you would rather keep the account and only remove some data,
            say which in the same email.
          </p>

          <h2 className="text-2xl font-bold mb-4 border-l-4 border-emerald-600 pl-4">What is deleted</h2>
          <ul className="list-disc pl-6 space-y-2 mb-10">
            <li>Your name, email address, phone number and sign-in details.</li>
            <li>Your investor-profile answers, lesson progress and notifications.</li>
            <li>Your portfolio journal: trades, holdings, dividends, allocation targets and price alerts.</li>
            <li>Your connections to financial advisers, and your referral record.</li>
          </ul>

          <h2 className="text-2xl font-bold mb-4 border-l-4 border-emerald-600 pl-4">What we keep, and why</h2>
          <ul className="list-disc pl-6 space-y-2 mb-10">
            <li>
              The reference and amount of payments, for as long as tax and accounting law requires. They are no longer
              linked to your profile.
            </li>
            <li>
              Your email address on our suppression list, if you had unsubscribed or an address bounced, so that we do not
              write to you again.
            </li>
            <li>Routine backups, which are overwritten on their normal rotation.</li>
          </ul>

          <p>
            More on what we collect and your rights is in the{" "}
            <Link href="/privacy" className="text-emerald-700 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

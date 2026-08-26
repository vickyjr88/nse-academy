import type { Metadata } from "next";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact Us - NSE Academy",
  description:
    "Get in touch with NSE Academy for questions, feedback, or corporate/SACCO licensing enquiries. We typically respond within 1 business day.",
  openGraph: {
    title: "Contact NSE Academy",
    description: "Have a question or want to explore corporate licensing? We'd love to hear from you.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://nseacademy.vitaldigitalmedia.net"}/contact`,
    siteName: "NSE Academy",
  },
  alternates: { canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://nseacademy.vitaldigitalmedia.net"}/contact` },
};

export default function ContactPage() {
  return (
    <>
      <PublicHeader />
      <ContactClient />
      <PublicFooter />
    </>
  );
}

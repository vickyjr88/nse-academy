"use client";

import { useState } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const SUBJECTS = [
  "General Enquiry",
  "Billing & Subscription",
  "Technical Support",
  "Corporate / SACCO Licensing",
  "Partnership & Advertising",
  "Content Feedback",
  "Other",
];

type Status = "idle" | "sending" | "success" | "error";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: SUBJECTS[0], message: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send");
      setStatus("success");
      setForm({ name: "", email: "", subject: SUBJECTS[0], message: "" });
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again or email us directly.");
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">

          {/* Left — info */}
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Get in touch</h1>
            <p className="text-gray-500 text-lg mb-10 leading-relaxed">
              Have a question, feedback, or want to explore corporate licensing for your SACCO or company?
              We&apos;d love to hear from you.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: "📧",
                  label: "Email",
                  value: "info@vitaldigitalmedia.net",
                  href: "mailto:info@vitaldigitalmedia.net",
                },
                {
                  icon: "📞",
                  label: "Phone / WhatsApp",
                  value: "+254 727 206 415",
                  href: "tel:+254727206415",
                },
                {
                  icon: "🐦",
                  label: "Twitter / X",
                  value: "@infinitydigy",
                  href: "https://twitter.com/infinitydigy",
                },
                {
                  icon: "🏢",
                  label: "Corporate & SACCO Licensing",
                  value: "View plans →",
                  href: "/pricing#corporate",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                    <a
                      href={item.href}
                      className="text-emerald-700 font-medium hover:underline text-sm"
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {item.value}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-sm font-semibold text-emerald-800 mb-1">Response time</p>
              <p className="text-sm text-emerald-700">
                We typically respond within 1 business day. For urgent billing issues, include your account email.
              </p>
            </div>
          </div>

          {/* Right — form */}
          <div>
            {status === "success" ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-16">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-3xl">✅</div>
                <h2 className="text-2xl font-bold text-gray-900">Message sent!</h2>
                <p className="text-gray-500 max-w-xs">
                  Thanks for reaching out. We&apos;ll get back to you within 1 business day.
                </p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-2 text-sm text-emerald-700 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Victor Karanja"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                  <select
                    value={form.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
                  <textarea
                    required
                    rows={6}
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    placeholder="Tell us how we can help..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="w-full bg-emerald-700 text-white font-semibold py-3.5 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {status === "sending" ? "Sending…" : "Send message →"}
                </button>

                <p className="text-xs text-center text-gray-400">
                  Or email us directly at{" "}
                  <a href="mailto:info@vitaldigitalmedia.net" className="text-emerald-700 hover:underline">
                    info@vitaldigitalmedia.net
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

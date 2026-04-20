"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CorporateRegisterForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [type, setType] = useState<"company" | "sacco">("company");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState(searchParams.get("plan") || "starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = searchParams.get("plan");
    if (p) setPlan(p);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("You must be logged in. Please log in first.");

      const regRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, email }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.message || "Registration failed");

      const payRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/license/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.message || "Payment initialization failed");

      window.location.href = payData.authorizationUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-700">NSE Academy</Link>
          <div className="text-4xl mt-3 mb-2">🏢</div>
          <h1 className="text-2xl font-bold text-gray-900">Register your organization</h1>
          <p className="mt-1 text-gray-500">Set up corporate access for your team or SACCO</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Acme Investment Group"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organization type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="company"
                    checked={type === "company"}
                    onChange={() => setType("company")}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">Company</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="sacco"
                    checked={type === "sacco"}
                    onChange={() => setType("sacco")}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">SACCO</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="admin@company.co.ke"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="starter">Starter — 5 seats / KSh 1,500/month</option>
                <option value="team">Team — 15 seats / KSh 3,500/month</option>
                <option value="sacco">SACCO — 50 seats / KSh 10,000/month</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-700 text-white font-semibold py-3 rounded-xl hover:bg-indigo-800 transition-colors disabled:opacity-60"
            >
              {loading ? "Processing…" : "Proceed to Payment →"}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-sm text-gray-500">
          <Link href="/pricing" className="text-indigo-700 font-medium hover:underline">← Back to Pricing</Link>
        </p>
      </div>
    </div>
  );
}

export default function CorporateRegisterPage() {
  return (
    <Suspense>
      <CorporateRegisterForm />
    </Suspense>
  );
}

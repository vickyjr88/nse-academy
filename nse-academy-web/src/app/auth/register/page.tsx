"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { decodeJwtPayload, identifyUser, trackEvent } from "@/lib/analytics";
import DurationPicker from "@/components/DurationPicker";
import type { BillingMonths, SubscriptionPlan } from "@/lib/pricing";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registeredPlan, setRegisteredPlan] = useState<SubscriptionPlan | null>(null);
  const [payLoading, setPayLoading] = useState<BillingMonths | null>(null);
  const [payError, setPayError] = useState("");

  // Pre-fill referral code and email from URL
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref);
      localStorage.setItem("referralCode", ref);
    } else {
      const saved = localStorage.getItem("referralCode");
      if (saved) setReferralCode(saved);
    }
    const prefillEmail = searchParams.get("email");
    if (prefillEmail) setEmail(prefillEmail);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, ...(phone ? { phone } : {}), ...(referralCode ? { referralCode } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      localStorage.setItem("access_token", data.access_token);
      localStorage.removeItem("referralCode");

      const payload = decodeJwtPayload<{
        sub?: string;
        email?: string;
        role?: string;
      }>(data.access_token);
      if (payload?.sub) {
        identifyUser(payload.sub, {
          email: payload.email,
          role: payload.role,
          name,
        });
      }
      trackEvent("auth_register_succeeded", {
        has_referral: Boolean(referralCode),
        has_phone: Boolean(phone),
        plan: searchParams.get("plan") ?? null,
      });

      if (plan === "intermediary" || plan === "premium") {
        setRegisteredPlan(plan);
      } else {
        const redirectTo = searchParams.get("redirectTo") || "/profile";
        router.push(redirectTo);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(months: BillingMonths) {
    if (!registeredPlan) return;
    setPayLoading(months);
    setPayError("");
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: registeredPlan, months }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start payment");
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Failed to start payment");
      setPayLoading(null);
    }
  }

  const plan = searchParams.get("plan");

  if (registeredPlan) {
    const redirectTo = searchParams.get("redirectTo") || "/profile";
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="text-2xl font-bold text-emerald-700">NSE Academy</Link>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">You&apos;re in! Choose your plan</h1>
            <p className="mt-1 text-gray-500">
              Pick how long you&apos;d like to subscribe. Longer plans save you more.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {payError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{payError}</div>
            )}
            <DurationPicker plan={registeredPlan} onSelect={handlePay} loadingMonths={payLoading} />
          </div>

          <p className="text-center mt-4 text-sm text-gray-500">
            <Link href={redirectTo} className="text-gray-400 hover:text-gray-600 hover:underline">
              Not now, continue on the free tier
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-emerald-700">NSE Academy</Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="mt-1 text-gray-500">
            {plan ? `You're signing up for the ${plan} plan` : "Start discovering your investor type"}
          </p>
        </div>

        {referralCode && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-emerald-800">
            <span className="text-xl">🎁</span>
            <span>You were referred! Both you and your friend will get <strong>1 month free</strong> when you subscribe.</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Jane Wanjiku"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="jane@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim())}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+254 7XX XXX XXX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Min. 8 characters"
              />
            </div>

            {/* Referral code field - pre-filled if from URL, otherwise manually enterable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referral code <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.trim())}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter a friend's referral code"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 text-white font-semibold py-3 rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-400">
            By signing up you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <p className="text-center mt-4 text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-emerald-700 font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

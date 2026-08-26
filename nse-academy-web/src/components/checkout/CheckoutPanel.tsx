"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import DurationPicker from "@/components/DurationPicker";
import type { BillingMonths } from "@/lib/pricing";
import {
  apiUrl,
  clearExpiredToken,
  downloadGuestEbook,
  downloadOwnedEbook,
  getAccessToken,
  getGuestUnlock,
  hasSubscriberAccess,
  loginRequest,
  registerRequest,
  saveGuestUnlock,
  TRADING_GUIDE_PRODUCT_ID,
  useAccessToken,
  useGuestUnlock,
  type DexterProduct,
  type EbookStatus,
} from "@/lib/ebook";

type AuthMode = "guest" | "login" | "register";
type PayPath = "ebook" | "intermediary" | "premium";

interface Props {
  product: DexterProduct;
}

export default function CheckoutPanel({ product }: Props) {
  const token = useAccessToken();
  const isLoggedIn = Boolean(token);
  const guestToken = useGuestUnlock(product.id);
  const guestUnlocked = Boolean(guestToken);
  const [ebookStatus, setEbookStatus] = useState<EbookStatus | null>(null);
  const [statusFetched, setStatusFetched] = useState(false);
  const statusLoading = Boolean(token) && !statusFetched;

  const [authMode, setAuthMode] = useState<AuthMode>("guest");
  const [payPath, setPayPath] = useState<PayPath>("ebook");

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const [durationLoading, setDurationLoading] = useState<BillingMonths | null>(null);

  const refreshStatus = useCallback(async () => {
    const access = getAccessToken();
    if (!access) {
      setEbookStatus(null);
      setStatusFetched(true);
      return;
    }
    try {
      const res = await fetch(`${apiUrl()}/ebook/status`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (res.status === 401) {
        // Token rejected by the API - fall back to guest so the email
        // field appears instead of dead-ending on "Email is required".
        clearExpiredToken();
        setEbookStatus(null);
        return;
      }
      const data = (await res.json()) as EbookStatus;
      setEbookStatus(data);
    } catch {
      /* keep previous */
    } finally {
      setStatusFetched(true);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${apiUrl()}/ebook/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (cancelled) return null;
        if (res.status === 401) {
          clearExpiredToken();
          return null;
        }
        return (await res.json()) as EbookStatus;
      })
      .then((data) => {
        if (!cancelled && data) setEbookStatus(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStatusFetched(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const alreadyOwned = ebookStatus?.purchases?.some((p) => p.productId === product.id);
  const hasSubAccess = hasSubscriberAccess(
    ebookStatus?.subscriberAccessProducts,
    product.id,
  );
  const canDownload = alreadyOwned || hasSubAccess || guestUnlocked;
  const paidSubActive =
    Boolean(ebookStatus?.subscriptionActive) &&
    ebookStatus?.subscriptionTier !== "free";

  const isTradingGuide = product.id === TRADING_GUIDE_PRODUCT_ID;

  async function handleDownload() {
    setDownloading(true);
    setError("");
    try {
      const guestToken = getGuestUnlock(product.id);
      if (guestToken && !alreadyOwned && !hasSubAccess) {
        const result = await downloadGuestEbook(guestToken, product.name);
        if (!result.ok) {
          setError(
            result.limitReached
              ? `${result.error} You can log in or create a free account with your purchase email for unlimited downloads.`
              : result.error,
          );
        }
        return;
      }
      const result = await downloadOwnedEbook(product.id, product.name);
      if (!result.ok) setError(result.error);
    } finally {
      setDownloading(false);
    }
  }

  async function startEbookPayment() {
    const token = getAccessToken();
    const checkoutEmail = email.trim() || undefined;
    if (!token && !checkoutEmail) {
      setError("Enter your email so we can send the ebook after payment.");
      return;
    }

    trackEvent("ebook_buy_clicked", {
      productId: product.id,
      name: product.name,
      priceKes: product.price,
      status: token ? "checkout_initiated" : "guest_checkout_initiated",
    });

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiUrl()}/ebook/purchase`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        productId: product.id,
        priceKes: product.price,
        ...(checkoutEmail ? { email: checkoutEmail } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    });
    const data = await res.json();

    if (data?.alreadyIncluded || data?.alreadyOwned) {
      if (data.guestToken) saveGuestUnlock(product.id, data.guestToken);
      await refreshStatus();
      return;
    }

    if (data?.authorization_url) {
      trackEvent("payment_initiated", {
        kind: "ebook",
        productId: product.id,
        priceKes: product.price,
        guest: !token,
      });
      window.location.href = data.authorization_url;
      return;
    }

    if (res.status === 401 || (res.status === 400 && !checkoutEmail)) {
      // The token we sent isn't accepted. Become a guest so the email
      // field renders, and ask for the one thing that unblocks checkout.
      clearExpiredToken();
      setAuthMode("guest");
      setError("Your session expired. Enter your email to continue as a guest.");
      return;
    }

    trackEvent("payment_init_failed", {
      kind: "ebook",
      productId: product.id,
      message: data?.message ?? null,
    });
    throw new Error(data?.message || "Failed to initialize payment. Please try again.");
  }

  async function startSubscriptionPayment(plan: "intermediary" | "premium", months: BillingMonths) {
    const token = getAccessToken();
    if (!token) {
      throw new Error("Create an account or log in to subscribe.");
    }
    const res = await fetch(`${apiUrl()}/payments/initialize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ plan, months }),
    });
    const data = await res.json();
    if (data?.authorization_url) {
      trackEvent("payment_initiated", { kind: "subscription", plan, months });
      window.location.href = data.authorization_url;
      return;
    }
    throw new Error(data?.message || "Failed to start subscription checkout.");
  }

  async function handleDurationSelect(months: BillingMonths) {
    if (payPath === "ebook") return;
    setDurationLoading(months);
    setError("");
    try {
      await startSubscriptionPayment(payPath, months);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start subscription checkout.");
      setDurationLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!isLoggedIn && payPath !== "ebook") {
        if (authMode === "guest") {
          setAuthMode("register");
          setError("Subscriptions need an account - create one below, it takes 20 seconds.");
          return;
        }
      }

      if (!isLoggedIn && authMode === "login") {
        await loginRequest(email, password);
        await refreshStatus();
      } else if (!isLoggedIn && authMode === "register") {
        if (name.trim().length < 2) {
          throw new Error("Please enter your name.");
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        await registerRequest({ name: name.trim(), email, password });
        await refreshStatus();
      }

      if (payPath === "ebook") {
        await startEbookPayment();
      } else {
        // Auth (if any) is done - reveal the duration picker instead of
        // paying immediately, so the user chooses 1/3/6/12 months first.
        setSubscriptionReady(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-gray-400 py-6">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Checking access…
      </div>
    );
  }

  if (canDownload) {
    return (
      <div className="space-y-3">
        {hasSubAccess && !alreadyOwned && (
          <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
            <span>✅</span>
            <span>
              Included with your{" "}
              <span className="capitalize font-bold">
                {ebookStatus?.subscriptionTier}
              </span>{" "}
              subscription - download free.
            </span>
          </div>
        )}
        {(alreadyOwned || guestUnlocked) && !hasSubAccess && (
          <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
            <span>📚</span>
            <span>You own this ebook. We also emailed the PDF to you.</span>
          </div>
        )}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full bg-emerald-700 text-white text-base font-bold py-4 rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {downloading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Preparing download…
            </>
          ) : (
            <>Download PDF</>
          )}
        </button>
        {isLoggedIn && (
          <Link
            href="/dashboard/downloads"
            className="block text-center text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Open your library →
          </Link>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </div>
    );
  }

  const ctaLabel = (() => {
    if (busy) return "Please wait…";
    if (payPath === "premium") return "Subscribe Premium - KSh 500/mo →";
    if (payPath === "intermediary") return "Subscribe Intermediary - KSh 300/mo →";
    return `Buy now - KSh ${product.price.toLocaleString("en-KE")} →`;
  })();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!paidSubActive && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Choose how you want it
          </p>
          <PayOption
            selected={payPath === "ebook"}
            onSelect={() => {
              setPayPath("ebook");
              setSubscriptionReady(false);
            }}
            title="One-time purchase"
            price={`KSh ${product.price.toLocaleString("en-KE")}`}
            detail="Keep the PDF forever. No account required."
          />
          {isTradingGuide && (
            <PayOption
              selected={payPath === "intermediary"}
              onSelect={() => {
                setPayPath("intermediary");
                setSubscriptionReady(false);
                if (!isLoggedIn) setAuthMode("register");
              }}
              title="Intermediary subscription"
              price="KSh 300/mo"
              detail="This guide + the full Trading Guide course. Cancel anytime."
              badge="Best for this book"
            />
          )}
          <PayOption
            selected={payPath === "premium"}
            onSelect={() => {
              setPayPath("premium");
              setSubscriptionReady(false);
              if (!isLoggedIn) setAuthMode("register");
            }}
            title="Premium subscription"
            price="KSh 500/mo"
            detail={
              isTradingGuide
                ? "Every ebook, stock advisor, research tools, and both PDFs."
                : "This ebook + every other guide, stock advisor, and research tools."
            }
            badge="Best value"
          />
        </div>
      )}

      {!isLoggedIn && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-3 text-xs font-semibold">
            {(["guest", "login", "register"] as AuthMode[]).map((mode) => {
              const disabled = payPath !== "ebook" && mode === "guest";
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setAuthMode(mode);
                    setError("");
                  }}
                  className={`py-2.5 capitalize transition-colors ${
                    authMode === mode
                      ? "bg-emerald-700 text-white"
                      : disabled
                        ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {mode === "guest" ? "Guest" : mode === "login" ? "Log in" : "Sign up"}
                </button>
              );
            })}
          </div>
          <div className="p-4 space-y-3 bg-white">
            {authMode === "guest" && (
              <p className="text-xs text-gray-500">
                Pay without an account. We email the PDF to you instantly.
              </p>
            )}
            {authMode === "register" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Jane Wanjiku"
                />
              </div>
            )}
            {authMode === "guest" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Jane Wanjiku"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="jane@example.com"
              />
            </div>
            {authMode !== "guest" && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={authMode === "register" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={authMode === "register" ? "Min. 8 characters" : "••••••••"}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {isLoggedIn && (
        <p className="text-xs text-gray-500 text-center">
          Logged in - the PDF lands in{" "}
          <Link href="/dashboard/downloads" className="text-emerald-700 font-semibold">
            your library
          </Link>{" "}
          and your inbox.
        </p>
      )}

      {subscriptionReady && payPath !== "ebook" ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Choose a duration
          </p>
          <DurationPicker plan={payPath} onSelect={handleDurationSelect} loadingMonths={durationLoading} />
        </div>
      ) : (
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-emerald-700 text-white text-base font-bold py-4 rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-100 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {ctaLabel}
            </>
          ) : (
            ctaLabel
          )}
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
    </form>
  );
}

function PayOption({
  selected,
  onSelect,
  title,
  price,
  detail,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  price: string;
  detail: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
        selected
          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
          : "border-gray-200 hover:border-emerald-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-emerald-700">{price}</p>
          {badge && (
            <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

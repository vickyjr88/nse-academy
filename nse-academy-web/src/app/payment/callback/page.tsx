"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { trackEvent } from "@/lib/analytics";
import {
  apiUrl,
  downloadOwnedEbook,
  downloadGuestEbook,
  fetchGuestAccessInfo,
  type GuestAccessInfo,
  getAccessToken,
  saveGuestUnlock,
  useAccessToken,
} from "@/lib/ebook";

type State = "verifying" | "success" | "error";
type PaymentType = "subscription" | "ebook";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const loggedIn = Boolean(useAccessToken());
  const [state, setState] = useState<State>(reference ? "verifying" : "error");
  const [tier, setTier] = useState<string>("");
  const [paymentType, setPaymentType] = useState<PaymentType>("subscription");
  const [errorMsg, setErrorMsg] = useState(
    reference ? "" : "No payment reference found.",
  );
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [guestInfo, setGuestInfo] = useState<GuestAccessInfo | null>(null);

  useEffect(() => {
    if (!reference) return;

    const token = getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`${apiUrl()}/payments/verify-any`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reference }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          const type: PaymentType = data.type === "ebook" ? "ebook" : "subscription";
          setPaymentType(type);
          setTier(data.tier || "");
          if (data.guestToken) {
            setGuestToken(data.guestToken);
            if (data.productId) saveGuestUnlock(data.productId, data.guestToken);
            // Probe only - never spend a download just by landing here.
            fetchGuestAccessInfo(data.guestToken).then((result) => {
              if (result.ok) {
                setGuestInfo(result.info);
                if (result.info.email) setEmail(result.info.email);
                if (result.info.productId) setProductId(result.info.productId);
              } else {
                setDownloadError(result.error);
              }
            });
          }
          if (data.productId) setProductId(data.productId);
          if (data.email) setEmail(data.email);
          setState("success");
          trackEvent("payment_succeeded", {
            kind: type,
            tier: data.tier ?? null,
            reference,
            guest: !token,
          });

          if (type === "subscription") {
            setTimeout(() => router.push("/dashboard/downloads"), 2500);
          }
        } else {
          trackEvent("payment_failed", {
            reference,
            message: data?.message ?? null,
          });
          setErrorMsg(data?.message || "Payment could not be confirmed.");
          setState("error");
        }
      })
      .catch(() => {
        trackEvent("payment_failed", {
          reference,
          message: "verify_network_error",
        });
        setErrorMsg("Network error. Please contact support with your reference.");
        setState("error");
      });
  }, [reference, router]);

  async function handleLoggedInDownload() {
    if (!productId) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const result = await downloadOwnedEbook(productId, "NSE_Academy_ebook");
      if (!result.ok) setDownloadError(result.error);
    } finally {
      setDownloading(false);
    }
  }

  async function handleGuestDownload() {
    if (!guestToken) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const result = await downloadGuestEbook(guestToken, "NSE_Academy_ebook");
      if (result.ok) {
        setGuestInfo(result.info);
      } else {
        if (result.info) setGuestInfo(result.info);
        setDownloadError(result.error);
      }
    } finally {
      setDownloading(false);
    }
  }

  const accessHref = guestToken ? `/ebooks/access/${guestToken}` : null;

  const shell = (inner: React.ReactNode) => (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      {inner}
      <PublicFooter />
    </div>
  );

  if (state === "verifying") {
    return shell(
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirming your payment…</h1>
        <p className="text-gray-500">Please wait, this takes a few seconds.</p>
        {reference && <p className="mt-6 text-xs text-gray-400 font-mono">Ref: {reference}</p>}
      </div>,
    );
  }

  if (state === "success") {
    const isEbook = paymentType === "ebook";
    return shell(
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 py-16">
        <div className="text-6xl mb-6">{isEbook ? "📚" : "🎉"}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          {isEbook ? "Thank you - your ebook is ready" : "You're all set!"}
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          {isEbook ? (
            <>
              Your PDF is ready to download.
              {email ? (
                <>
                  {" "}
                  We also emailed it to <span className="font-medium">{email}</span>.
                </>
              ) : (
                " We also emailed a copy to you."
              )}
            </>
          ) : (
            <>
              Your{" "}
              <span className="font-semibold text-emerald-700 capitalize">{tier}</span>{" "}
              subscription is now active. Included ebooks are in your library.
            </>
          )}
        </p>

        {isEbook && (
          <div className="mt-8 w-full max-w-sm space-y-3">
            {guestToken && !guestInfo?.limitReached ? (
              <button
                onClick={handleGuestDownload}
                disabled={downloading}
                className="w-full bg-emerald-700 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-800 disabled:opacity-60"
              >
                {downloading ? "Preparing download…" : "Download PDF now"}
              </button>
            ) : guestToken && guestInfo?.limitReached ? (
              <Link
                href={accessHref!}
                className="block w-full bg-emerald-700 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-800"
              >
                Download limit reached - get unlimited access
              </Link>
            ) : loggedIn && productId ? (
              <button
                onClick={handleLoggedInDownload}
                disabled={downloading}
                className="w-full bg-emerald-700 text-white font-bold py-3.5 rounded-xl hover:bg-emerald-800 disabled:opacity-60"
              >
                {downloading ? "Preparing download…" : "Download PDF now"}
              </button>
            ) : (
              <p className="text-sm text-gray-500">Preparing your download link…</p>
            )}

            {accessHref && (
              <p className="text-sm text-gray-600">
                {guestInfo
                  ? `${guestInfo.remainingDownloads} of ${guestInfo.maxDownloads} downloads remaining on this link. `
                  : "Save this link to download again later. "}
                <Link
                  href={accessHref}
                  className="text-emerald-700 font-semibold hover:underline"
                >
                  Open download page
                </Link>
              </p>
            )}

            {downloadError && (
              <p className="text-sm text-red-600">{downloadError}</p>
            )}
            {loggedIn ? (
              <Link
                href="/dashboard/downloads"
                className="block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Go to your library →
              </Link>
            ) : (
              <Link
                href={`/auth/register?redirectTo=${encodeURIComponent("/dashboard/downloads")}${email ? `&email=${encodeURIComponent(email)}` : ""}`}
                className="block text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              >
                Create a free account to keep your downloads →
              </Link>
            )}
          </div>
        )}

        {!isEbook && (
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            Taking you to your library…
          </div>
        )}
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-5xl mb-6">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Payment activation failed</h1>
      <p className="text-gray-500 max-w-md mx-auto mb-6">{errorMsg}</p>
      <p className="text-sm text-gray-400 mb-2">
        Reference: <span className="font-mono">{reference}</span>
      </p>
      <p className="text-sm text-gray-500">
        If you were charged, please email{" "}
        <a href="mailto:support@vitaldigitalmedia.net" className="text-emerald-700 underline">
          support@vitaldigitalmedia.net
        </a>{" "}
        with your reference number.
      </p>
      <button
        onClick={() => router.push("/store")}
        className="mt-8 bg-emerald-700 text-white px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors"
      >
        Back to store
      </button>
    </div>,
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type State = "verifying" | "success" | "error";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [state, setState] = useState<State>("verifying");
  const [tier, setTier] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!reference) {
      setErrorMsg("No payment reference found.");
      setState("error");
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reference }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setTier(data.tier);
          setState("success");
          setTimeout(() => router.push("/dashboard"), 2500);
        } else {
          setErrorMsg(data?.message || "Payment could not be confirmed.");
          setState("error");
        }
      })
      .catch(() => {
        setErrorMsg("Network error. Please contact support with your reference.");
        setState("error");
      });
  }, [reference, router]);

  if (state === "verifying") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-6" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Activating your subscription…</h1>
        <p className="text-gray-500">Please wait, this takes a few seconds.</p>
        {reference && <p className="mt-6 text-xs text-gray-400 font-mono">Ref: {reference}</p>}
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">You&apos;re all set!</h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Your <span className="font-semibold text-emerald-700 capitalize">{tier}</span> subscription is now active.
        </p>
        <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Taking you to the dashboard…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-5xl mb-6">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Subscription activation failed</h1>
      <p className="text-gray-500 max-w-md mx-auto mb-6">{errorMsg}</p>
      <p className="text-sm text-gray-400 mb-2">Reference: <span className="font-mono">{reference}</span></p>
      <p className="text-sm text-gray-500">
        If you were charged, please email{" "}
        <a href="mailto:support@vitaldigitalmedia.net" className="text-emerald-700 underline">
          support@vitaldigitalmedia.net
        </a>{" "}
        with your reference number.
      </p>
      <button
        onClick={() => router.push("/dashboard")}
        className="mt-8 bg-emerald-700 text-white px-6 py-3 rounded-xl hover:bg-emerald-800 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
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

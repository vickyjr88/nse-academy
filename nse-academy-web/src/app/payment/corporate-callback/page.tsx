"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type State = "verifying" | "success" | "error";

function CorporateCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");
  const [state, setState] = useState<State>("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!reference) { setErrorMsg("No payment reference found."); setState("error"); return; }
    const token = localStorage.getItem("access_token");
    if (!token) { router.push("/auth/login"); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/license/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reference }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          setState("success");
          setTimeout(() => router.push("/dashboard/corporate"), 2000);
        } else {
          setErrorMsg(data?.message || "License could not be activated.");
          setState("error");
        }
      })
      .catch(() => { setErrorMsg("Network error. Contact support with your reference."); setState("error"); });
  }, [reference, router]);

  if (state === "verifying") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Activating your license…</h1>
      <p className="text-gray-500">Please wait a moment.</p>
    </div>
  );

  if (state === "success") return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-6">🏢</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Corporate License Activated!</h1>
      <p className="text-lg text-gray-600 max-w-md mx-auto">
        Your organization now has full access to NSE Academy. Head to your admin dashboard to invite your team.
      </p>
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        Taking you to your dashboard…
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-5xl mb-6">⚠️</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">License activation failed</h1>
      <p className="text-gray-500 max-w-md mx-auto mb-4">{errorMsg}</p>
      <p className="text-sm text-gray-400">Ref: <span className="font-mono">{reference}</span></p>
      <p className="text-sm text-gray-500 mt-2">
        Email <a href="mailto:support@vitaldigitalmedia.net" className="text-indigo-700 underline">support@vitaldigitalmedia.net</a> for help.
      </p>
      <button onClick={() => router.push("/dashboard")} className="mt-8 bg-indigo-700 text-white px-6 py-3 rounded-xl hover:bg-indigo-800 transition-colors">
        Go to Dashboard
      </button>
    </div>
  );
}

export default function CorporateCallbackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <CorporateCallbackHandler />
    </Suspense>
  );
}

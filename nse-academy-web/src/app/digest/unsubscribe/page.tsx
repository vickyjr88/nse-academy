"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { unsubscribeDigest } from "@/lib/digest";

function Unsubscribe() {
  const params = useSearchParams();
  const u = params.get("u") ?? "";
  const t = params.get("t") ?? "";
  const [state, setState] = useState<"working" | "done" | "invalid">(u && t ? "working" : "invalid");

  useEffect(() => {
    if (!u || !t) return;
    let live = true;
    unsubscribeDigest(u, t).then((ok) => live && setState(ok ? "done" : "invalid"));
    return () => { live = false; };
  }, [u, t]);

  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      {state === "working" ? <p className="text-gray-500">Turning off your evening digest…</p> : null}
      {state === "done" ? (
        <>
          <h1 className="mb-3 text-2xl font-bold text-gray-900">You are unsubscribed</h1>
          <p className="mb-6 text-gray-600">We will not send you the evening market digest any more. You can turn it back on any time in your account settings.</p>
          <Link href="/dashboard/account" className="font-medium text-emerald-700 underline">Go to account settings</Link>
        </>
      ) : null}
      {state === "invalid" ? (
        <>
          <h1 className="mb-3 text-2xl font-bold text-gray-900">This link did not work</h1>
          <p className="mb-6 text-gray-600">It may be incomplete or out of date. Sign in and turn the digest off in your account settings instead.</p>
          <Link href="/dashboard/account" className="font-medium text-emerald-700 underline">Go to account settings</Link>
        </>
      ) : null}
    </main>
  );
}

export default function DigestUnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <Unsubscribe />
    </Suspense>
  );
}

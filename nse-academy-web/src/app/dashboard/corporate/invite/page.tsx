"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Status = "loading" | "need-auth" | "accepting" | "success" | "error";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("This invite link is missing its token.");
      return;
    }

    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      setStatus("need-auth");
      return;
    }

    acceptInvite(accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function acceptInvite(accessToken: string) {
    setStatus("accepting");
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/corporate/invite/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "This invite link is invalid or has expired.");
      setStatus("success");
      setTimeout(() => router.push("/dashboard/corporate"), 1500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    }
  }

  const redirectTo = `/dashboard/corporate/invite?token=${token ?? ""}`;

  if (status === "loading") {
    return <div className="flex items-center justify-center py-20 text-gray-400">Loading…</div>;
  }

  if (status === "need-auth") {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="text-5xl mb-4">🏢</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;ve been invited to join an organization</h2>
        <p className="text-gray-500 mb-6">
          Log in or create an account with the email address this invite was sent to, then you&apos;ll be
          added automatically.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-800 transition-colors"
          >
            Log in
          </Link>
          <Link
            href={`/auth/register?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="text-indigo-700 font-medium hover:underline"
          >
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  if (status === "accepting") {
    return <div className="flex items-center justify-center py-20 text-gray-400">Joining organization…</div>;
  }

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re in!</h2>
        <p className="text-gray-500">Redirecting you to your organization…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Couldn&apos;t accept this invite</h2>
      <p className="text-gray-500 mb-6">{error}</p>
      <Link href="/dashboard/corporate" className="text-indigo-700 font-medium hover:underline">
        Go to your dashboard
      </Link>
    </div>
  );
}

export default function AcceptCorporateInvitePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400">Loading…</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}

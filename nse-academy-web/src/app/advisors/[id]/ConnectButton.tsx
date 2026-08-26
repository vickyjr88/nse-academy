"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/ebook";
import { requestConnection } from "@/lib/advisor";

export default function ConnectButton({ advisorId }: { advisorId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleConnect() {
    const token = getAccessToken();
    if (!token) {
      router.push(`/auth/login?redirectTo=${encodeURIComponent(`/advisors/${advisorId}`)}`);
      return;
    }

    setStatus("loading");
    setError("");
    try {
      await requestConnection(advisorId);
      setStatus("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
        Connection request sent. The advisor will review and accept it before you can see each other&apos;s
        details.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={status === "loading"}
        className="bg-emerald-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-800 transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Connect with this advisor"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

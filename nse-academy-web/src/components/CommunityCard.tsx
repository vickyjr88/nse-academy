"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

/** Premium members' door to the investors' community. Renders nothing until a channel has been set up, so it never links to a place that is not there. */
export default function CommunityCard({ tier }: { tier: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (tier !== "premium") return;
    let live = true;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/community`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setUrl(d?.whatsappChannelUrl ?? null))
      .catch(() => undefined);
    return () => { live = false; };
  }, [tier]);

  if (tier !== "premium" || !url) return null;
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold text-emerald-900">Join the investors&apos; community</h2>
        <p className="mt-1 text-sm text-emerald-800">A members-only WhatsApp space for market talk and monthly live questions with our advisors. Education and discussion only: no tips, no price calls, and be kind.</p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("community_join_clicked")}
        className="shrink-0 rounded-xl bg-emerald-700 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
      >
        Join on WhatsApp
      </a>
    </div>
  );
}

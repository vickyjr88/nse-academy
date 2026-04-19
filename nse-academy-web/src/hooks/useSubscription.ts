"use client";
import { useEffect, useState } from "react";

export type Tier = "free" | "intermediary" | "premium";

export interface Subscription {
  tier: Tier;
  status: string;
  freeMonths?: number;
  currentPeriodEnd?: string;
}

const TIER_LEVEL: Record<Tier, number> = { free: 0, intermediary: 1, premium: 2 };

export function useSubscription() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setSub)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tier: Tier = sub?.tier ?? "free";

  function canAccess(required: Tier): boolean {
    return TIER_LEVEL[tier] >= TIER_LEVEL[required];
  }

  return { sub, tier, loading, canAccess };
}

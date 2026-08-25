import type { Broker } from "@/lib/journal";

export type { Broker };

export async function listPublicBrokers(): Promise<Broker[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/brokers`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

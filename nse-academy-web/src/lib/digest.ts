import { getAccessToken } from "@/lib/ebook";

function apiUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL}${path}`;
}

function headers(): HeadersInit {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/** The member's evening-digest setting. */
export async function getDigestPreference(): Promise<boolean> {
  const res = await fetch(apiUrl("/digest"), { headers: headers() });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()).enabled === true;
}

export async function setDigestPreference(enabled: boolean): Promise<boolean> {
  const res = await fetch(apiUrl("/digest"), { method: "PUT", headers: headers(), body: JSON.stringify({ enabled }) });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()).enabled === true;
}

/** The one-click link in the email: no sign-in, proven by the signed token it carries. */
export async function unsubscribeDigest(u: string, t: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/public/digest/unsubscribe"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ u, t }) });
    return res.ok;
  } catch {
    return false;
  }
}

// First-party, cookie-free visitor tracking. An anonymous random id lives in this browser's localStorage; each page view
// sends that id, the page path and (on the first page of a visit) where the visitor came from. No IP address or
// user-agent string is stored by the server. Visitors who send "Do Not Track" are not counted.

const API = process.env.NEXT_PUBLIC_API_URL;
const VID_KEY = "nse_vid";
const ATTR_KEY = "nse_attr";

export interface Attribution {
  visitorId?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
}

function doNotTrack(): boolean {
  return navigator.doNotTrack === "1" || (window as unknown as { doNotTrack?: string }).doNotTrack === "1";
}

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

function hostOf(url: string): string | undefined {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return h && h !== window.location.hostname.replace(/^www\./, "") ? h : undefined;
  } catch {
    return undefined;
  }
}

/** What brought this visit: the referring site and any utm_* tags, remembered for the whole visit (tab session). */
function visitAttribution(path: string): Attribution {
  try {
    const saved = sessionStorage.getItem(ATTR_KEY);
    if (saved) return JSON.parse(saved) as Attribution;
    const q = new URLSearchParams(window.location.search);
    const a: Attribution = {
      referrerHost: document.referrer ? hostOf(document.referrer) : undefined,
      utmSource: q.get("utm_source") ?? undefined,
      utmMedium: q.get("utm_medium") ?? undefined,
      utmCampaign: q.get("utm_campaign") ?? undefined,
      landingPath: path.split("?")[0],
    };
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(a));
    return a;
  } catch {
    return {};
  }
}

/** Attribution to send with a signup, so the admin can see which channels produce members. */
export function signupAttribution(): Attribution | undefined {
  try {
    const id = localStorage.getItem(VID_KEY) ?? undefined;
    const saved = sessionStorage.getItem(ATTR_KEY);
    const a: Attribution = saved ? JSON.parse(saved) : {};
    const out: Attribution = { ...a, visitorId: id };
    return Object.values(out).some(Boolean) ? out : undefined;
  } catch {
    return undefined;
  }
}

/** Records one page view. Safe to call on every route change; never throws and never blocks navigation. */
export function trackPageView(path: string): void {
  try {
    if (!API || doNotTrack()) return;
    const v = visitorId();
    if (!v) return;
    // The visit's source is sent with every page view of the visit, so "where did visitors come from" counts the whole
    // visit, not just its first page (later pages would otherwise all read as direct traffic).
    const a = visitAttribution(path);
    const body = JSON.stringify({
      v,
      p: path,
      ...(a.referrerHost ? { r: `https://${a.referrerHost}/` } : {}),
      ...(a.utmSource ? { us: a.utmSource } : {}),
      ...(a.utmMedium ? { um: a.utmMedium } : {}),
      ...(a.utmCampaign ? { uc: a.utmCampaign } : {}),
    });
    void fetch(`${API}/public/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
  } catch {
    /* tracking must never break a page */
  }
}

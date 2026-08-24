import { useSyncExternalStore } from "react";
import { decodeJwtPayload, identifyUser, trackEvent } from "@/lib/analytics";

export const TRADING_GUIDE_PRODUCT_ID =
  "4c379aa9-2035-47d8-b8fd-bacc860eea7c";

export const STOREFRONT_URL =
  "https://dexter-api.vitaldigitalmedia.net/api/products/storefront/51fe5af0-266b-419e-8559-3f0febcd74c4";

export interface DexterProduct {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  thumbnail: string | null;
  description: string;
  category: string;
  is_digital: boolean;
  status: string;
}

export interface EbookStatus {
  purchases: { productId: string; purchasedAt: string; guestToken?: string }[];
  /** null = all products (premium), string[] = specific IDs (possibly empty) */
  subscriberAccessProducts: string[] | null;
  subscriptionTier: string;
  subscriptionActive?: boolean;
}

export function apiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || "";
}

const AUTH_EVENT = "nse-auth-changed";
const UNLOCK_EVENT = "nse-ebook-unlock";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function subscribeAuth(onChange: () => void) {
  window.addEventListener(AUTH_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(AUTH_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function subscribeUnlock(onChange: () => void) {
  window.addEventListener(UNLOCK_EVENT, onChange);
  return () => window.removeEventListener(UNLOCK_EVENT, onChange);
}

/** SSR-safe snapshot of the JWT without an effect. */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeAuth, getAccessToken, () => null);
}

export function useGuestUnlock(productId: string): string | null {
  return useSyncExternalStore(
    subscribeUnlock,
    () => getGuestUnlock(productId),
    () => null,
  );
}

export function hasSubscriberAccess(
  products: string[] | null | undefined,
  productId: string,
): boolean {
  if (products === null) return true;
  if (Array.isArray(products)) return products.includes(productId);
  return false;
}

export function triggerFileDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function saveGuestUnlock(productId: string, token: string) {
  try {
    localStorage.setItem(`ebook_unlock_${productId}`, token);
    window.dispatchEvent(new Event(UNLOCK_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getGuestUnlock(productId: string): string | null {
  try {
    return localStorage.getItem(`ebook_unlock_${productId}`);
  } catch {
    return null;
  }
}

function safeFileName(name: string) {
  return `${name.replace(/[^a-z0-9]/gi, "_")}.pdf`;
}

export async function downloadOwnedEbook(
  productId: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = getAccessToken();
  if (!token) {
    window.location.assign(`/ebooks/buy/${productId}`);
    return { ok: false, error: "Please complete checkout to download." };
  }

  const res = await fetch(
    `${apiUrl()}/ebook/download/${encodeURIComponent(productId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    window.location.assign(
      `/auth/login?redirectTo=${encodeURIComponent(`/ebooks/buy/${productId}`)}`,
    );
    return { ok: false, error: "Please log in again." };
  }

  if (res.status === 403 && data?.code === "PURCHASE_REQUIRED") {
    const path = data.checkoutPath || `/ebooks/buy/${productId}`;
    window.location.assign(path);
    return { ok: false, error: "Taking you to checkout…" };
  }

  if (!res.ok) {
    return { ok: false, error: data?.message || "Download failed. Please try again." };
  }

  if (!data.download_url) {
    return { ok: false, error: "Invalid download URL" };
  }

  triggerFileDownload(data.download_url, data.file_name || safeFileName(name));
  return { ok: true };
}

export const MAX_GUEST_DOWNLOADS = 2;

export interface GuestAccessInfo {
  productId?: string;
  email?: string;
  downloadCount: number;
  maxDownloads: number;
  remainingDownloads: number;
  limitReached: boolean;
}

/**
 * Read a guest link's state WITHOUT spending one of its downloads.
 * Page loads must use this — only an explicit click may call
 * fetchGuestDownload / downloadGuestEbook, which consume a download.
 */
export async function fetchGuestAccessInfo(
  guestToken: string,
): Promise<{ ok: true; info: GuestAccessInfo } | { ok: false; error: string }> {
  const res = await fetch(
    `${apiUrl()}/ebook/guest-access/${encodeURIComponent(guestToken)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error:
        data?.message ||
        "This download link is invalid. Please check your email or complete checkout.",
    };
  }
  if (data.productId) saveGuestUnlock(data.productId, guestToken);
  return { ok: true, info: guestAccessInfoFrom(data) };
}

function guestAccessInfoFrom(data: Record<string, unknown>): GuestAccessInfo {
  const maxDownloads = Number(data.maxDownloads ?? MAX_GUEST_DOWNLOADS);
  const downloadCount = Number(data.downloadCount ?? 0);
  const remainingDownloads = Number(
    data.remainingDownloads ?? Math.max(0, maxDownloads - downloadCount),
  );
  return {
    productId: data.productId as string | undefined,
    email: data.email as string | undefined,
    downloadCount,
    maxDownloads,
    remainingDownloads,
    limitReached: Boolean(data.limitReached) || remainingDownloads <= 0,
  };
}

/** Consumes one of the link's downloads. Only call on an explicit user action. */
export async function fetchGuestDownload(guestToken: string): Promise<
  | {
      ok: true;
      downloadUrl: string;
      fileName: string;
      productId?: string;
      email?: string;
      info: GuestAccessInfo;
    }
  | { ok: false; error: string; limitReached?: boolean; info?: GuestAccessInfo }
> {
  const res = await fetch(
    `${apiUrl()}/ebook/guest-download/${encodeURIComponent(guestToken)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data?.code === "DOWNLOAD_LIMIT_REACHED") {
      return {
        ok: false,
        limitReached: true,
        info: guestAccessInfoFrom(data),
        error:
          data?.message ||
          "This link has reached its download limit. Log in with your purchase email to download your copy.",
      };
    }
    return {
      ok: false,
      error:
        data?.message ||
        "This download link is invalid. Please check your email or complete checkout.",
    };
  }
  if (!data.download_url) {
    return { ok: false, error: "Invalid download URL" };
  }
  if (data.productId) saveGuestUnlock(data.productId, guestToken);
  return {
    ok: true,
    downloadUrl: data.download_url as string,
    fileName: (data.file_name as string) || "NSE_Academy_ebook.pdf",
    productId: data.productId,
    email: data.email,
    info: guestAccessInfoFrom(data),
  };
}

export async function downloadGuestEbook(
  guestToken: string,
  name: string,
): Promise<
  | { ok: true; productId?: string; email?: string; info: GuestAccessInfo }
  | { ok: false; error: string; limitReached?: boolean; info?: GuestAccessInfo }
> {
  const result = await fetchGuestDownload(guestToken);
  if (!result.ok) return result;
  triggerFileDownload(result.downloadUrl, result.fileName || safeFileName(name));
  return {
    ok: true,
    productId: result.productId,
    email: result.email,
    info: result.info,
  };
}

export async function persistAuthToken(accessToken: string, extra?: Record<string, unknown>) {
  localStorage.setItem("access_token", accessToken);
  window.dispatchEvent(new Event(AUTH_EVENT));
  const payload = decodeJwtPayload<{
    sub?: string;
    email?: string;
    role?: string;
  }>(accessToken);
  if (payload?.sub) {
    identifyUser(payload.sub, {
      email: payload.email,
      role: payload.role,
      ...extra,
    });
  }
}

export async function loginRequest(email: string, password: string) {
  const res = await fetch(`${apiUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  await persistAuthToken(data.access_token);
  trackEvent("auth_login_succeeded", { method: "password", source: "checkout" });
  return data;
}

export async function registerRequest(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const referralCode =
    typeof window !== "undefined"
      ? localStorage.getItem("referralCode") || undefined
      : undefined;
  const res = await fetch(`${apiUrl()}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
      ...(input.phone ? { phone: input.phone } : {}),
      ...(referralCode ? { referralCode } : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Registration failed");
  localStorage.removeItem("referralCode");
  await persistAuthToken(data.access_token, { name: input.name });
  trackEvent("auth_register_succeeded", {
    has_referral: Boolean(referralCode),
    has_phone: Boolean(input.phone),
    source: "checkout",
  });
  return data;
}

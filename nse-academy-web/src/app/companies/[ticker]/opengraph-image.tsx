import { ImageResponse } from "next/og";
import { getStockProfileByTicker } from "@/lib/cms";
import { getMarketQuote } from "@/lib/market-quote";

export const alt = "NSE company profile - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

// Satori supports flexbox only, so every container is display:flex.
export default async function Image({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const [profile, quote] = await Promise.all([getStockProfileByTicker(ticker.toUpperCase()), getMarketQuote(ticker)]);
  const change = quote?.change ?? "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#052e24", color: "#ffffff", padding: "56px 72px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="7" fill="#10b981" />
              <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#6ee7b7" }}>NSE ACADEMY</span>
          </div>
          <span style={{ fontSize: 24, color: "#a7f3d0" }}>Company profile</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#34d399", letterSpacing: 2 }}>NSE: {(profile?.ticker ?? ticker).toUpperCase()}</span>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.08, maxWidth: 1050 }}>{profile?.company_name ?? "Nairobi Securities Exchange"}</div>
          {profile ? <span style={{ fontSize: 30, color: "#a7f3d0" }}>{profile.sector} - share price, dividend yield and risk profile</span> : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {quote ? (
            <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 16, padding: "14px 24px" }}>
              <span style={{ fontSize: 18, color: "#a7f3d0" }}>Latest price</span>
              <span style={{ fontSize: 34, fontWeight: 800, color: change.startsWith("-") ? "#f87171" : "#34d399" }}>
                KSh {quote.price.toFixed(2)} {change}
              </span>
            </div>
          ) : null}
          <span style={{ fontSize: 24, color: "#6ee7b7" }}>nseacademy.vitaldigitalmedia.net</span>
        </div>
      </div>
    ),
    size,
  );
}

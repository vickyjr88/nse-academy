import { ImageResponse } from "next/og";
import { fmtKes, fmtPct, getMarketReport } from "@/lib/market-report";

export const alt = "NSE daily market report - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

// Satori (the engine behind ImageResponse) supports flexbox only, so every
// container below is display:flex.
export default async function Image({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const r = await getMarketReport(date);
  const f = r?.facts;
  const g = f?.gainers[0];
  const l = f?.losers[0];

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
          <span style={{ fontSize: 24, color: "#a7f3d0" }}>Daily market report</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 28, fontWeight: 600, color: "#6ee7b7" }}>{r?.label ?? date}</span>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1.12, maxWidth: 1050 }}>
            {r?.headline ?? "NSE market report"}
          </div>
        </div>

        {f ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 16, padding: "14px 24px" }}>
              <span style={{ fontSize: 18, color: "#a7f3d0" }}>Breadth</span>
              <span style={{ fontSize: 34, fontWeight: 800 }}>{f.breadth.advancers} up / {f.breadth.decliners} down</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 16, padding: "14px 24px" }}>
              <span style={{ fontSize: 18, color: "#a7f3d0" }}>Value traded</span>
              <span style={{ fontSize: 34, fontWeight: 800 }}>{fmtKes(f.valueTradedKes)}</span>
            </div>
            {g ? (
              <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 16, padding: "14px 24px" }}>
                <span style={{ fontSize: 18, color: "#a7f3d0" }}>Top gainer</span>
                <span style={{ fontSize: 34, fontWeight: 800, color: "#34d399" }}>{g.ticker} {fmtPct(g.changePct)}</span>
              </div>
            ) : null}
            {l ? (
              <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 16, padding: "14px 24px" }}>
                <span style={{ fontSize: 18, color: "#a7f3d0" }}>Top loser</span>
                <span style={{ fontSize: 34, fontWeight: 800, color: "#f87171" }}>{l.ticker} {fmtPct(l.changePct)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}

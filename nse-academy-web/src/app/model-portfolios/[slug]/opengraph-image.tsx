import { ImageResponse } from "next/og";
import { getModelPortfolio, RISK_LABELS } from "@/lib/model-portfolios";
import { SITE_HOST } from "@/lib/seo";

export const alt = "NSE model portfolio - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 600;

// Satori supports flexbox only; every container is display:flex.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await getModelPortfolio(slug);
  const m = found?.model;

  const name = m?.name ?? "NSE model portfolio";
  const summary = m?.summary ?? "An illustrative portfolio of NSE-listed stocks, tracked on real closing prices.";
  const riskLabel = m?.riskProfile ? (RISK_LABELS[m.riskProfile] ?? m.riskProfile) : null;
  const topHoldings = m?.holdings.slice(0, 5) ?? [];
  const perf = m?.performance;
  const sincePct = perf?.sincePct;

  const fmtPct = (n: number) =>
    `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#052e24",
          color: "#ffffff",
          padding: "56px 72px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="7" fill="#10b981" />
              <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#6ee7b7" }}>NSE ACADEMY</span>
          </div>
          {riskLabel && (
            <span
              style={{
                background: "#064e3b",
                color: "#6ee7b7",
                borderRadius: 100,
                padding: "8px 20px",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              {riskLabel}
            </span>
          )}
        </div>

        {/* Title + summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: name.length > 40 ? 50 : 62, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>
            {name}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a7f3d0", lineHeight: 1.4, maxWidth: 860 }}>
            {summary.length > 160 ? `${summary.slice(0, 157)}…` : summary}
          </div>
        </div>

        {/* Footer row: holdings + performance */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {topHoldings.map((h) => (
            <div
              key={h.ticker}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#064e3b",
                borderRadius: 14,
                padding: "12px 20px",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 800, color: "#6ee7b7" }}>{h.ticker}</span>
              <span style={{ fontSize: 16, color: "#a7f3d0" }}>{h.weightPct.toFixed(0)}%</span>
            </div>
          ))}
          {sincePct != null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#064e3b",
                borderRadius: 14,
                padding: "12px 20px",
                marginLeft: "auto",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 18, color: "#a7f3d0" }}>Since inception</span>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: sincePct >= 0 ? "#34d399" : "#f87171",
                }}
              >
                {fmtPct(sincePct)}
              </span>
            </div>
          )}
          <span style={{ fontSize: 20, color: "#6ee7b7", marginLeft: sincePct != null ? 0 : "auto" }}>{SITE_HOST}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

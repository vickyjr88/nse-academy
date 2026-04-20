import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NSE Academy Blog — Market News, Analysis & Weekly Roundups";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const categories = [
  { label: "NSE News", bg: "#eff6ff", color: "#1d4ed8" },
  { label: "Weekly Roundup", bg: "#f5f3ff", color: "#6d28d9" },
  { label: "Daily Update", bg: "#fffbeb", color: "#b45309" },
  { label: "Market Analysis", bg: "#ecfdf5", color: "#047857" },
  { label: "Stock Deep Dive", bg: "#f0fdfa", color: "#0f766e" },
  { label: "IPO Watch", bg: "#fff7ed", color: "#c2410c" },
  { label: "Investor Education", bg: "#eef2ff", color: "#4338ca" },
];

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#0f172a",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          flex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <svg width="36" height="36" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="#047857" />
            <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ color: "#64748b", fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>NSE ACADEMY</span>
        </div>

        {/* Title */}
        <div style={{ color: "white", fontSize: 62, fontWeight: 800, lineHeight: 1.05, marginBottom: 20 }}>
          NSE Academy{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #34d399, #059669)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Blog
          </span>
        </div>

        {/* Description */}
        <div style={{ color: "#94a3b8", fontSize: 22, lineHeight: 1.5, maxWidth: 520, marginBottom: 40 }}>
          Daily market updates · Weekly roundups · Stock analysis · Investor education
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {categories.slice(0, 4).map((c) => (
            <div
              key={c.label}
              style={{
                background: c.bg,
                color: c.color,
                borderRadius: 100,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* Right: stacked article cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          justifyContent: "center",
          padding: "60px 60px 60px 0",
          width: 340,
        }}
      >
        {[
          { cat: categories[0], title: "NSE Weekly Market Roundup" },
          { cat: categories[3], title: "Safaricom Q3 Earnings Analysis" },
          { cat: categories[6], title: "How to Read an Annual Report" },
          { cat: categories[4], title: "KCB Group Deep Dive" },
        ].map((card) => (
          <div
            key={card.title}
            style={{
              background: "#1e293b",
              borderRadius: 12,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              border: "1px solid #334155",
            }}
          >
            <div
              style={{
                background: card.cat.bg,
                color: card.cat.color,
                borderRadius: 100,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                alignSelf: "flex-start",
              }}
            >
              {card.cat.label}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
              {card.title}
            </div>
          </div>
        ))}
      </div>
    </div>,
    size
  );
}

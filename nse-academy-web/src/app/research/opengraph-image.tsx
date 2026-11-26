import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/seo";

export const alt = "NSE Research - Monthly focus lists and company briefs - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori supports flexbox only; every container is display:flex.
export default function Image() {
  const categories = [
    { label: "Monthly focus list", desc: "Stocks that passed all three screens this month" },
    { label: "Company brief", desc: "One stock, all the numbers, a named reviewer" },
  ];

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
        {/* Watermark chart line */}
        <svg
          width="420"
          height="180"
          viewBox="0 0 420 180"
          style={{ position: "absolute", right: 56, top: 72, opacity: 0.08 }}
        >
          <polyline
            points="0,160 70,120 140,80 210,100 280,40 350,60 420,10"
            stroke="white"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="420" cy="10" r="7" fill="white" />
        </svg>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#10b981" />
            <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#6ee7b7" }}>NSE ACADEMY</span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 800, lineHeight: 1.08 }}>NSE research</div>
          <div style={{ display: "flex", fontSize: 28, color: "#a7f3d0", lineHeight: 1.4, maxWidth: 760 }}>
            Stocks worth a closer look — the numbers shown, a named reviewer, and a plain explanation.
          </div>
        </div>

        {/* Category cards */}
        <div style={{ display: "flex", gap: 20 }}>
          {categories.map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#064e3b",
                borderRadius: 16,
                padding: "18px 28px",
                gap: 6,
                flex: 1,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: "#6ee7b7" }}>{c.label}</span>
              <span style={{ fontSize: 17, color: "#a7f3d0" }}>{c.desc}</span>
            </div>
          ))}
          <span style={{ fontSize: 20, color: "#6ee7b7", alignSelf: "flex-end", marginLeft: "auto" }}>{SITE_HOST}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

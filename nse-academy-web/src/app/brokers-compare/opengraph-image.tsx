import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Compare NSE Broker Fees - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ROWS = [
  { name: "AIB - AXYS Africa", fee: "1.9%" },
  { name: "Faida Investment Bank", fee: "1.9%" },
  { name: "Ziidi Trader", fee: "1.0%" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 80px",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <svg width="32" height="32" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="6" fill="#047857" />
              <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ color: "#64748b", fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>NSE ACADEMY</span>
          </div>
          <div style={{ color: "#0f172a", fontSize: 52, fontWeight: 800, lineHeight: 1.1, textAlign: "center" }}>
            Compare NSE broker fees
          </div>
          <div style={{ color: "#64748b", fontSize: 20 }}>See what brokers actually charge before you trade.</div>
        </div>

        <div
          style={{
            background: "white",
            border: "1.5px solid #e2e8f0",
            borderRadius: 20,
            width: 640,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {ROWS.map((r, i) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 28px",
                borderBottom: i < ROWS.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
            >
              <span style={{ color: "#0f172a", fontSize: 22, fontWeight: 600 }}>{r.name}</span>
              <span style={{ color: "#047857", fontSize: 24, fontWeight: 800 }}>{r.fee}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}

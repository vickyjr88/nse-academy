import { ImageResponse } from "next/og";


export const runtime = "edge";
export const alt = "NSE Academy Pricing — Simple, Transparent Plans";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
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
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <svg width="32" height="32" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="#047857" />
            <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ color: "#64748b", fontSize: 16, fontWeight: 600, letterSpacing: 1 }}>NSE ACADEMY</span>
        </div>
        <div style={{ color: "#0f172a", fontSize: 52, fontWeight: 800, lineHeight: 1.1, textAlign: "center" }}>
          Simple, transparent pricing
        </div>
        <div style={{ color: "#64748b", fontSize: 20 }}>Start free. Upgrade when you&apos;re ready.</div>
      </div>

      {/* Pricing cards */}
      <div style={{ display: "flex", gap: 20 }}>
        {/* Free */}
        <div
          style={{
            background: "white",
            border: "1.5px solid #e2e8f0",
            borderRadius: 20,
            padding: "28px 28px",
            width: 240,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 700 }}>Free</div>
          <div style={{ color: "#0f172a", fontSize: 36, fontWeight: 800 }}>KSh 0</div>
          {["Investor profiler", "3 starter modules", "NSE glossary"].map((f) => (
            <div key={f} style={{ display: "flex", gap: 8, color: "#475569", fontSize: 14 }}>
              <span style={{ color: "#047857", fontWeight: 700 }}>✓</span><span>{f}</span>
            </div>
          ))}
        </div>

        {/* Intermediary */}
        <div
          style={{
            background: "white",
            border: "1.5px solid #d1fae5",
            borderRadius: 20,
            padding: "28px 28px",
            width: 240,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#fbbf24",
              color: "#78350f",
              borderRadius: 100,
              padding: "4px 14px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Most Popular
          </div>
          <div style={{ color: "#0f172a", fontSize: 22, fontWeight: 700 }}>Intermediary</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ color: "#0f172a", fontSize: 36, fontWeight: 800 }}>KSh 100</span>
            <span style={{ color: "#94a3b8", fontSize: 16 }}>/mo</span>
          </div>
          {["Full trading guide", "62 companies", "Stockbroker guide"].map((f) => (
            <div key={f} style={{ display: "flex", gap: 8, color: "#475569", fontSize: 14 }}>
              <span style={{ color: "#047857", fontWeight: 700 }}>✓</span><span>{f}</span>
            </div>
          ))}
        </div>

        {/* Premium */}
        <div
          style={{
            background: "#047857",
            borderRadius: 20,
            padding: "28px 28px",
            width: 240,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ color: "white", fontSize: 22, fontWeight: 700 }}>Premium</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ color: "white", fontSize: 36, fontWeight: 800 }}>KSh 500</span>
            <span style={{ color: "#a7f3d0", fontSize: 16 }}>/mo</span>
          </div>
          {["Full Investor's Guide", "Stock advisor", "Company research"].map((f) => (
            <div key={f} style={{ display: "flex", gap: 8, color: "#d1fae5", fontSize: 14 }}>
              <span style={{ color: "#6ee7b7", fontWeight: 700 }}>✓</span><span>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    size
  );
}

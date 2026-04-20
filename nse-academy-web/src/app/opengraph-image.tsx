import { ImageResponse } from "next/og";


export const runtime = "edge";
export const alt = "NSE Academy — Discover Your Investor Type. Build Your NSE Portfolio.";
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
        justifyContent: "flex-end",
        padding: "72px 80px",
        background: "linear-gradient(135deg, #064e3b 0%, #047857 60%, #065f46 100%)",
        position: "relative",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Chart watermark */}
      <svg
        width="480"
        height="200"
        viewBox="0 0 480 200"
        style={{ position: "absolute", right: 60, top: 80, opacity: 0.12 }}
      >
        <polyline
          points="0,180 80,140 160,100 240,120 320,60 400,80 480,20"
          stroke="white"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="480" cy="20" r="8" fill="white" />
      </svg>

      {/* Logo mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <svg width="44" height="44" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="6" fill="rgba(255,255,255,0.15)" />
          <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>
          NSE ACADEMY
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          color: "white",
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 20,
          maxWidth: 780,
        }}
      >
        <span>Discover your investor type.&nbsp;</span>
        <span style={{ color: "#6ee7b7" }}>Build your NSE portfolio.</span>
      </div>

      {/* Subtext */}
      <div style={{ color: "#a7f3d0", fontSize: 24, fontWeight: 400, maxWidth: 680 }}>
        Personalised learning paths and stock recommendations for Kenyan investors.
      </div>

      {/* Investor type badges */}
      <div style={{ display: "flex", gap: 10, marginTop: 40 }}>
        {["Conservative", "Moderate", "Aggressive", "Dividend Seeker", "Growth Investor"].map((t) => (
          <div
            key={t}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 100,
              padding: "6px 16px",
              color: "white",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {t}
          </div>
        ))}
      </div>
    </div>,
    size
  );
}

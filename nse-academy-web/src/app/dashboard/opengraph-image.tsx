import { ImageResponse } from "next/og";


export const alt = "NSE Academy — Your Investor Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background grid dots */}
      <svg
        width="1200"
        height="630"
        viewBox="0 0 1200 630"
        style={{ position: "absolute", inset: 0, opacity: 0.06 }}
      >
        {Array.from({ length: 12 }).map((_, col) =>
          Array.from({ length: 7 }).map((_, row) => (
            <circle
              key={`${col}-${row}`}
              cx={col * 110 + 55}
              cy={row * 105 + 52}
              r="2"
              fill="white"
            />
          ))
        )}
      </svg>

      {/* Left content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          flex: 1,
          gap: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
          <svg width="40" height="40" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="rgba(255,255,255,0.2)" />
            <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 17, fontWeight: 600, letterSpacing: 1 }}>NSE ACADEMY</span>
        </div>

        <div style={{ color: "white", fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 20 }}>
          Your personalised<br />
          <span style={{ color: "#6ee7b7" }}>NSE investor dashboard</span>
        </div>
        <div style={{ color: "#a7f3d0", fontSize: 22, lineHeight: 1.5, maxWidth: 480 }}>
          Track your learning, explore stocks, and build your Nairobi portfolio with confidence.
        </div>
      </div>

      {/* Right: dashboard UI mockup cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 12,
          padding: "60px 60px 60px 0",
          width: 360,
        }}
      >
        {[
          { icon: "🎯", label: "Investor Profile", value: "Growth Investor" },
          { icon: "📚", label: "Course Progress", value: "6 / 13 chapters" },
          { icon: "📈", label: "Watchlist", value: "12 NSE stocks" },
          { icon: "🏦", label: "Broker Account", value: "AIB AXYS Africa" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 14,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <span style={{ fontSize: 24 }}>{card.icon}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: 600 }}>{card.label}</span>
              <span style={{ color: "white", fontSize: 15, fontWeight: 700 }}>{card.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>,
    size
  );
}

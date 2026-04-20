import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Contact NSE Academy — We'd love to hear from you";
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
        background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
        fontFamily: "system-ui, sans-serif",
        gap: 24,
        padding: "60px 80px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 64 }}>✉️</div>
      <div style={{ color: "white", fontSize: 58, fontWeight: 800, lineHeight: 1.1 }}>
        Get in touch
      </div>
      <div style={{ color: "#a7f3d0", fontSize: 24, maxWidth: 600 }}>
        Questions, feedback, or corporate licensing enquiries — we&apos;d love to hear from you.
      </div>
      <div
        style={{
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 100,
          padding: "10px 28px",
          color: "white",
          fontSize: 18,
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        info@vitaldigitalmedia.net
      </div>
    </div>,
    size
  );
}

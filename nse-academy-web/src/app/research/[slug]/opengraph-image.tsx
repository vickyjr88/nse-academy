import { ImageResponse } from "next/og";
import { getResearchNote } from "@/lib/research";
import { SITE_HOST } from "@/lib/seo";

export const alt = "NSE research note - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 600;

// Satori supports flexbox only; every container is display:flex.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const n = await getResearchNote(slug);

  const kind = n?.kind === "FOCUS_LIST" ? "Monthly focus list" : "Company brief";
  const title = n?.title ?? "NSE research note";
  const summary = n?.summary ?? "An in-depth look at NSE-listed stocks, with the numbers shown and a named reviewer.";
  const tickers = n?.tickers ?? [];

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
          <span style={{ fontSize: 22, color: "#a7f3d0" }}>{kind}</span>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {tickers.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {tickers.slice(0, 6).map((t) => (
                <span
                  key={t}
                  style={{
                    background: "#064e3b",
                    color: "#6ee7b7",
                    borderRadius: 8,
                    padding: "6px 16px",
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", fontSize: title.length > 60 ? 46 : 56, fontWeight: 800, lineHeight: 1.1, maxWidth: 1050 }}>
            {title}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#a7f3d0", lineHeight: 1.4, maxWidth: 920 }}>
            {summary.length > 160 ? `${summary.slice(0, 157)}…` : summary}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 16, padding: "14px 24px" }}>
            <span style={{ fontSize: 18, color: "#a7f3d0" }}>Reviewed by a named professional</span>
            <span style={{ fontSize: 24, fontWeight: 700 }}>Education, not advice</span>
          </div>
          <span style={{ fontSize: 22, color: "#6ee7b7", marginLeft: "auto" }}>{SITE_HOST}</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

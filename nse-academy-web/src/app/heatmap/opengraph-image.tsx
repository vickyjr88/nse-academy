import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/seo";
import { fmtChange, getHeatmap, heatColor, squarify } from "@/lib/heatmap";

export const alt = "NSE heatmap: every listed company sized by market cap and coloured by today's price change - NSE Academy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

const MAP = { w: 664, h: 534 };
const GROUND = "#0a0e0c";

// Shown only when the data cannot be fetched: a neutral, unlabelled pattern, so the card never implies a market move.
const PLACEHOLDER = [40, 14, 10, 8, 7, 6, 5, 4, 3, 3, 2, 2, 1.5, 1, 1];

/** Satori reads comma-separated rgb() only. */
const css = (pct: number) => heatColor(pct).replace(/rgb\((\d+) (\d+) (\d+)\)/, "rgb($1,$2,$3)");

function labelSize(ticker: string, w: number, h: number): number | null {
  const font = Math.min(44, Math.sqrt(w * h) * 0.2, (w - 8) / (0.66 * ticker.length), h - 6);
  return font >= 9 ? font : null;
}

// Satori (the engine behind ImageResponse) supports flexbox only; absolutely positioned boxes are fine.
export default async function Image() {
  const map = await getHeatmap();
  const live = Boolean(map?.tiles.length);
  const tiles = live
    ? squarify(map!.tiles.map((t) => ({ value: t.marketCap, data: t })), { x: 0, y: 0, w: MAP.w, h: MAP.h })
    : squarify(PLACEHOLDER.map((v, i) => ({ value: v, data: { ticker: `P${i}`, changePct: 0 } })), { x: 0, y: 0, w: MAP.w, h: MAP.h });
  const pct = map?.changePct ?? 0;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#052e24", color: "#ffffff", padding: "48px 56px", gap: 44, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 380 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="7" fill="#10b981" />
              <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#6ee7b7" }}>NSE ACADEMY</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.02 }}>NSE heatmap</div>
            <div style={{ display: "flex", fontSize: 27, lineHeight: 1.3, color: "#a7f3d0" }}>
              Every listed company. Bigger tile, bigger company. Green is up, red is down.
            </div>
          </div>

          {map && live ? (
            <div style={{ display: "flex", flexDirection: "column", background: "#064e3b", borderRadius: 18, padding: "16px 24px", gap: 2 }}>
              <span style={{ fontSize: 18, color: "#a7f3d0" }}>The market today</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <span style={{ fontSize: 46, fontWeight: 800, color: pct > 0 ? "#34d399" : pct < 0 ? "#f87171" : "#ffffff" }}>{fmtChange(pct)}</span>
                <span style={{ fontSize: 24, color: "#d1fae5" }}>
                  {map.advancers} up, {map.decliners} down
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 24, color: "#6ee7b7" }}>{SITE_HOST}</div>
          )}
        </div>

        <div style={{ display: "flex", position: "relative", width: MAP.w, height: MAP.h, alignSelf: "center", background: GROUND, borderRadius: 18, overflow: "hidden" }}>
          {tiles.map((t) => {
            const font = live ? labelSize(t.data.ticker, t.w, t.h) : null;
            return (
              <div
                key={t.data.ticker}
                style={{
                  position: "absolute",
                  left: t.x,
                  top: t.y,
                  width: t.w,
                  height: t.h,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: live ? css(t.data.changePct) : "#16241f",
                  border: `1.5px solid ${GROUND}`,
                  color: "#ffffff",
                  overflow: "hidden",
                }}
              >
                {font ? <span style={{ fontSize: font, fontWeight: 800, lineHeight: 1 }}>{t.data.ticker}</span> : null}
                {font && font >= 20 && t.h >= font * 2.3 ? (
                  <span style={{ fontSize: font * 0.5, marginTop: 4, opacity: 0.9 }}>{fmtChange(t.data.changePct)}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...size },
  );
}

import { ImageResponse } from "next/og";
import {
  CARD_SLIDES,
  MarketReport,
  MoverFact,
  fmtKes,
  fmtPct,
  fmtPrice,
  getMarketReport,
} from "@/lib/market-report";

// 9:16 story/reel cards for Instagram, TikTok, YouTube Shorts and WhatsApp Status.
// GET /market-report/2026-11-04/card/1 ... /card/5
//
// Satori (the engine behind ImageResponse) supports flexbox only, so every
// container is display:flex, and long text is trimmed in code because it does
// not ellipsise on its own.

const W = 1080;
const H = 1920;
const BG = "linear-gradient(180deg, #052e24 0%, #064e3b 100%)";
const UP = "#34d399";
const DOWN = "#f87171";
const MUTED = "#a7f3d0";

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}...`);

function Frame({ step, children, url }: { step: number; children: React.ReactNode; url: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: BG, color: "#fff", padding: "96px 80px 80px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#10b981" />
            <polyline points="6,24 6,8 26,24 26,8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: 5, color: "#6ee7b7" }}>NSE ACADEMY</span>
        </div>
        <span style={{ fontSize: 34, color: MUTED }}>{step} / {CARD_SLIDES}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", paddingTop: 40, paddingBottom: 40 }}>{children}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ fontSize: 34, fontWeight: 700, color: "#6ee7b7" }}>{url}</span>
        <span style={{ fontSize: 26, color: "#6ee7b7", opacity: 0.8 }}>Educational content, not investment advice.</span>
      </div>
    </div>
  );
}

function MoverRows({ title, subtitle, movers, color }: { title: string; subtitle: string; movers: MoverFact[]; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05 }}>{title}</span>
        <span style={{ fontSize: 36, color: MUTED }}>{subtitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {movers.length === 0 ? (
          <span style={{ fontSize: 44, color: MUTED }}>None met the liquidity threshold today.</span>
        ) : (
          movers.map((m) => (
            <div key={m.ticker} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.07)", borderRadius: 28, padding: "30px 40px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 64, fontWeight: 800 }}>{m.ticker}</span>
                <span style={{ fontSize: 30, color: MUTED }}>{clip(m.name, 28)} &middot; KSh {fmtPrice(m.price)}</span>
              </div>
              <span style={{ fontSize: 68, fontWeight: 800, color }}>{fmtPct(m.changePct)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function slideBody(slide: number, r: MarketReport): React.ReactNode {
  const f = r.facts;
  const total = Math.max(f.breadth.advancers + f.breadth.decliners + f.breadth.unchanged, 1);

  switch (slide) {
    case 1:
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: 4, color: UP }}>NSE DAILY REPORT</span>
            <span style={{ fontSize: 46, color: MUTED }}>{r.label}</span>
          </div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.08 }}>{clip(r.headline, 120)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 56, fontWeight: 800 }}>
              <span style={{ color: UP }}>{f.breadth.advancers} up</span>
              <span style={{ color: DOWN }}>{f.breadth.decliners} down</span>
            </div>
            <div style={{ display: "flex", height: 28, borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.15)" }}>
              <div style={{ display: "flex", width: `${(f.breadth.advancers / total) * 100}%`, background: UP }} />
              <div style={{ display: "flex", width: `${(f.breadth.unchanged / total) * 100}%`, background: "#9ca3af" }} />
              <div style={{ display: "flex", width: `${(f.breadth.decliners / total) * 100}%`, background: DOWN }} />
            </div>
            <span style={{ fontSize: 40, color: MUTED }}>{fmtKes(f.valueTradedKes)} traded{f.valueVsAvgNote ? ` - ${f.valueVsAvgNote}` : ""}</span>
          </div>
        </div>
      );
    case 2:
      return <MoverRows title="Top gainers" subtitle={r.label} movers={f.gainers} color={UP} />;
    case 3:
      return <MoverRows title="Top losers" subtitle={r.label} movers={f.losers} color={DOWN} />;
    case 4:
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05 }}>Most traded</span>
            <span style={{ fontSize: 36, color: MUTED }}>
              {f.concentration ? `${f.concentration.ticker} was ${f.concentration.sharePct}% of all value traded` : "By value traded"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {f.active.map((m) => (
              <div key={m.ticker} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.07)", borderRadius: 28, padding: "30px 40px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 64, fontWeight: 800 }}>{m.ticker}</span>
                  <span style={{ fontSize: 30, color: m.changePct >= 0 ? UP : DOWN }}>{fmtPct(m.changePct)}</span>
                </div>
                <span style={{ fontSize: 60, fontWeight: 800 }}>{fmtKes(m.valueKes)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    default: {
      const lesson = r.lessons[0];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: 4, color: UP }}>TODAY&apos;S LESSON</span>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800, lineHeight: 1.1 }}>{clip(lesson?.title ?? "Read the full report", 90)}</div>
          <div style={{ display: "flex", fontSize: 42, lineHeight: 1.45, color: "#d1fae5" }}>{clip(lesson?.body ?? r.summary, 330)}</div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: "#10b981", color: "#052e24", fontSize: 40, fontWeight: 800, padding: "26px 44px", borderRadius: 24 }}>
            Full report + more lessons
          </div>
        </div>
      );
    }
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ date: string; slide: string }> }) {
  const { date, slide } = await params;
  const n = Number(slide);
  if (!Number.isInteger(n) || n < 1 || n > CARD_SLIDES) return new Response("Not found", { status: 404 });

  const report = await getMarketReport(date);
  if (!report) return new Response("Not found", { status: 404 });

  // Host + section only: the dated address wraps mid-word on a phone-width card, and the CTA points at the report list anyway.
  const shortUrl = "nseacademy.vitaldigitalmedia.net/market-report";
  return new ImageResponse(<Frame step={n} url={shortUrl}>{slideBody(n, report)}</Frame>, {
    width: W,
    height: H,
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}

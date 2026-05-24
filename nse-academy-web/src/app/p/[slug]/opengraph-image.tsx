import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NSE Academy — Shared Investor Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface PublicProfile {
  type: string;
  riskScore: number;
  horizonYears: number;
  capitalRange: string;
  displayName: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; accent: string }
> = {
  conservative: { label: "Conservative Investor", color: "#16a34a", accent: "#bbf7d0" },
  moderate: { label: "Moderate Investor", color: "#2563eb", accent: "#bfdbfe" },
  aggressive: { label: "Aggressive Investor", color: "#ea580c", accent: "#fed7aa" },
  growth: { label: "Growth Investor", color: "#7c3aed", accent: "#ddd6fe" },
  dividend: { label: "Dividend Seeker", color: "#ca8a04", accent: "#fef08a" },
};

async function fetchProfile(slug: string): Promise<PublicProfile | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) return null;
  try {
    const res = await fetch(`${apiBase}/profiler/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PublicProfile;
  } catch {
    return null;
  }
}

function radarPoints(riskScore: number, cx: number, cy: number, r: number): string {
  const axes = [
    Math.max(10, 100 - riskScore),                         // Safety
    Math.max(10, Math.round(80 - riskScore * 0.6)),        // Income
    riskScore,                                             // Growth
    Math.min(100, Math.round(50 + riskScore * 0.2)),       // Liquidity
    Math.max(5, Math.round(riskScore * 0.9)),              // Experience
  ];
  return axes
    .map((value, i) => {
      const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
      const distance = (value / 100) * r;
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      return `${x},${y}`;
    })
    .join(" ");
}

export default async function Image({ params }: { params: { slug: string } }) {
  const profile = await fetchProfile(params.slug);

  const config = profile ? TYPE_CONFIG[profile.type] ?? TYPE_CONFIG.moderate : TYPE_CONFIG.moderate;
  const displayName = profile?.displayName ?? "NSE Investor";
  const riskScore = profile?.riskScore ?? 50;
  const horizonYears = profile?.horizonYears ?? 5;
  const capitalRange = profile?.capitalRange ?? "—";

  const radar = radarPoints(riskScore, 990, 330, 150);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "64px 80px",
          background: "linear-gradient(135deg, #064e3b 0%, #047857 60%, #065f46 100%)",
          position: "relative",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Background watermark grid */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: "absolute", inset: 0, opacity: 0.05 }}
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1200" height="630" fill="url(#grid)" />
        </svg>

        {/* Header / brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg width="40" height="40" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="6" fill="rgba(255,255,255,0.15)" />
            <polyline
              points="6,24 6,8 26,24 26,8"
              stroke="white"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            NSE ACADEMY
          </span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, marginLeft: 12 }}>
            • Investor Profile
          </span>
        </div>

        {/* Main row: text left, radar right */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 22, marginBottom: 12 }}>
              {displayName} is a
            </div>
            <div
              style={{
                color: "white",
                fontSize: 76,
                fontWeight: 800,
                lineHeight: 1.05,
                marginBottom: 24,
              }}
            >
              <span style={{ color: config.accent }}>{config.label}</span>
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              <Stat label="Risk score" value={`${riskScore}/100`} />
              <Stat label="Horizon" value={`${horizonYears} yr${horizonYears === 1 ? "" : "s"}`} />
              <Stat label="Capital" value={capitalRange} />
            </div>
          </div>

          {/* Radar chart */}
          <svg width="340" height="340" viewBox="780 160 420 340" style={{ marginLeft: 24 }}>
            {[0.25, 0.5, 0.75, 1].map((scale) => (
              <polygon
                key={scale}
                points={[0, 1, 2, 3, 4]
                  .map((i) => {
                    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                    const x = 990 + Math.cos(angle) * 150 * scale;
                    const y = 330 + Math.sin(angle) * 150 * scale;
                    return `${x},${y}`;
                  })
                  .join(" ")}
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
              />
            ))}
            <polygon
              points={radar}
              fill={config.accent}
              fillOpacity="0.45"
              stroke={config.accent}
              strokeWidth="3"
            />
            {["Safety", "Income", "Growth", "Liquidity", "Experience"].map((subj, i) => {
              const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
              const x = 990 + Math.cos(angle) * 180;
              const y = 330 + Math.sin(angle) * 180;
              return (
                <text
                  key={subj}
                  x={x}
                  y={y}
                  fill="rgba(255,255,255,0.7)"
                  fontSize="14"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {subj}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Footer watermark */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "rgba(255,255,255,0.55)",
            fontSize: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Take the free 10-question quiz at
            <span style={{ color: "white", fontWeight: 600, marginLeft: 6 }}>
              nseacademy.vitaldigitalmedia.net
            </span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)" }}>nseacademy.vdm.net/investor-profiler</div>
        </div>
      </div>
    ),
    size
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 16,
        padding: "14px 20px",
        minWidth: 160,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 4 }}>{label}</span>
      <span style={{ color: "white", fontSize: 26, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

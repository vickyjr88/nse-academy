/** A plain SVG line of a model's value since inception (100 at the start). Server-safe, no chart library. */
export default function Sparkline({ series, label }: { series: { date: string; value: number }[]; label: string }) {
  if (series.length < 2) return null;
  const W = 320;
  const H = 80;
  const pad = 4;
  const values = series.map((p) => p.value);
  const lo = Math.min(...values, 100);
  const hi = Math.max(...values, 100);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i / (series.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2);
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const up = series[series.length - 1].value >= 100;
  return (
    <div className="w-64 max-w-full">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-20 w-full">
      <line x1={pad} x2={W - pad} y1={y(100)} y2={y(100)} stroke="#d1d5db" strokeDasharray="3 3" strokeWidth="1" />
      <path d={path} fill="none" stroke={up ? "#047857" : "#dc2626"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1].value)} r="3" fill={up ? "#047857" : "#dc2626"} />
    </svg>
    </div>
  );
}

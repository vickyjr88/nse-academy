export interface HeatmapTile {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  /** Change since the previous close, in percent. */
  changePct: number;
  /** Price x shares in issue, in KES. */
  marketCap: number;
}

export interface HeatmapSector {
  sector: string;
  marketCap: number;
  changePct: number;
  count: number;
}

export interface Heatmap {
  asOf: string | null;
  sharesAsOf: string;
  totalMarketCap: number;
  changePct: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  sectors: HeatmapSector[];
  tiles: HeatmapTile[];
}

/** The heatmap data, or null on any failure: a missing map must never break the page around it. */
export async function getHeatmap(): Promise<Heatmap | null> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/public/market-data/heatmap`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as Heatmap;
    return Array.isArray(data.tiles) ? data : null;
  } catch {
    return null;
  }
}

// ---- layout ----------------------------------------------------------------------------------------------------------

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Weighted<T> {
  value: number;
  data: T;
}

/**
 * Squarified treemap (Bruls, Huizing and van Wijk): fills `rect` with one rectangle per item, each with an area proportional
 * to its value and as close to square as the order allows, which keeps labels readable. Items need not be sorted, but the
 * result is best, and tiles are returned largest first, when they are. Items with a value of zero or less are dropped.
 */
export function squarify<T>(items: Weighted<T>[], rect: Rect): (Rect & { data: T })[] {
  const live = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = live.reduce((s, i) => s + i.value, 0);
  if (!live.length || total <= 0 || rect.w <= 0 || rect.h <= 0) return [];

  const scale = (rect.w * rect.h) / total;
  const nodes = live.map((i) => ({ area: i.value * scale, data: i.data }));
  const sum = (xs: { area: number }[]) => xs.reduce((s, n) => s + n.area, 0);

  /** The worst (most elongated) aspect ratio in a row of the given areas laid along a side of this length. */
  const worst = (row: { area: number }[], side: number) => {
    const s = sum(row);
    const areas = row.map((n) => n.area);
    return Math.max((side * side * Math.max(...areas)) / (s * s), (s * s) / (side * side * Math.min(...areas)));
  };

  const out: (Rect & { data: T })[] = [];
  let r = { ...rect };
  let i = 0;
  while (i < nodes.length) {
    const side = Math.min(r.w, r.h);
    const row = [nodes[i]];
    let j = i + 1;
    while (j < nodes.length && worst([...row, nodes[j]], side) <= worst(row, side)) row.push(nodes[j++]);

    const s = sum(row);
    if (r.w >= r.h) {
      // The short side is vertical: the row is a column on the left.
      const cw = s / r.h;
      let y = r.y;
      for (const n of row) {
        const h = n.area / cw;
        out.push({ x: r.x, y, w: cw, h, data: n.data });
        y += h;
      }
      r = { x: r.x + cw, y: r.y, w: r.w - cw, h: r.h };
    } else {
      const rh = s / r.w;
      let x = r.x;
      for (const n of row) {
        const w = n.area / rh;
        out.push({ x, y: r.y, w, h: rh, data: n.data });
        x += w;
      }
      r = { x: r.x, y: r.y + rh, w: r.w, h: r.h - rh };
    }
    i = j;
  }
  return out;
}

// ---- colour ----------------------------------------------------------------------------------------------------------

/** Changes beyond this many percent in either direction all get the strongest colour. */
export const COLOR_CAP_PCT = 3;

// Muted in the middle so a quiet day reads as quiet, saturated at the ends so a real move stands out.
// Every stop keeps white text above about 4.5:1.
const STOPS: [number, [number, number, number]][] = [
  [-COLOR_CAP_PCT, [184, 50, 42]],
  [-1.5, [143, 47, 49]],
  [-0.5, [92, 43, 48]],
  [0, [58, 65, 70]],
  [0.5, [38, 90, 69]],
  [1.5, [31, 122, 77]],
  [COLOR_CAP_PCT, [18, 135, 76]],
];

export function heatColor(changePct: number): string {
  const v = Math.max(-COLOR_CAP_PCT, Math.min(COLOR_CAP_PCT, Number.isFinite(changePct) ? changePct : 0));
  for (let k = 1; k < STOPS.length; k++) {
    const [b, cb] = STOPS[k];
    if (v <= b) {
      const [a, ca] = STOPS[k - 1];
      const t = (v - a) / (b - a);
      const c = ca.map((x, n) => Math.round(x + (cb[n] - x) * t));
      return `rgb(${c[0]} ${c[1]} ${c[2]})`;
    }
  }
  const last = STOPS[STOPS.length - 1][1];
  return `rgb(${last[0]} ${last[1]} ${last[2]})`;
}

/** The legend bar uses the same stops as the tiles. */
export function legendGradient(): string {
  return `linear-gradient(90deg, ${STOPS.map(([v, c]) => `rgb(${c[0]} ${c[1]} ${c[2]}) ${((v + COLOR_CAP_PCT) / (2 * COLOR_CAP_PCT)) * 100}%`).join(", ")})`;
}

// ---- formatting ------------------------------------------------------------------------------------------------------

/** "+1.6%", "-0.5%", "0.0%". A real minus sign would be nicer to read, but keep it plain so it copies cleanly. */
export function fmtChange(pct: number): string {
  const r = Math.round(pct * 10) / 10;
  if (r === 0) return "0.0%";
  return `${r > 0 ? "+" : "-"}${Math.abs(r).toFixed(1)}%`;
}

export function fmtCap(kes: number): string {
  if (kes >= 1e12) return `KSh ${(kes / 1e12).toFixed(2)} trillion`;
  if (kes >= 1e9) return `KSh ${(kes / 1e9).toFixed(kes >= 1e10 ? 0 : 1)} billion`;
  return `KSh ${Math.round(kes / 1e6)} million`;
}

export function fmtPrice(p: number): string {
  return new Intl.NumberFormat("en-KE", { minimumFractionDigits: p < 100 ? 2 : 0, maximumFractionDigits: 2 }).format(p);
}

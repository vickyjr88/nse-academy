"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLOR_CAP_PCT,
  fmtCap,
  fmtChange,
  fmtPrice,
  heatColor,
  legendGradient,
  squarify,
  type HeatmapSector,
  type HeatmapTile,
  type Rect,
} from "@/lib/heatmap";

interface Props {
  tiles: HeatmapTile[];
  sectors: HeatmapSector[];
  totalMarketCap: number;
  /** Tickers that have a company page to open. The rest show their details but are not links. */
  linkable: string[];
}

type Mode = "all" | "sector";

interface Placed {
  tile: HeatmapTile;
  rect: Rect;
}
interface PlacedSector {
  sector: HeatmapSector;
  rect: Rect;
  header: boolean;
}

const HEADER_PX = 18;
const GROUND = "rgb(10 14 12)";

/** Layout for the measured width: a tall map on a phone so more tiles can carry a label, a wide one on a desk. */
function heightFor(width: number): number {
  if (width < 520) return Math.round(width * 1.25);
  if (width < 900) return Math.round(width * 0.8);
  return Math.min(Math.round(width * 0.62), 720);
}

function place(tiles: HeatmapTile[], sectors: HeatmapSector[], mode: Mode, width: number, height: number) {
  const whole: Rect = { x: 0, y: 0, w: width, h: height };
  if (mode === "all") {
    return {
      tiles: squarify(tiles.map((t) => ({ value: t.marketCap, data: t })), whole).map((p) => ({ tile: p.data, rect: p })),
      sectors: [] as PlacedSector[],
    };
  }
  const placedSectors: PlacedSector[] = [];
  const placed: Placed[] = [];
  for (const s of squarify(sectors.map((x) => ({ value: x.marketCap, data: x })), whole)) {
    const header = s.w >= 64 && s.h >= 44;
    placedSectors.push({ sector: s.data, rect: s, header });
    const inner: Rect = header ? { x: s.x + 1, y: s.y + HEADER_PX, w: s.w - 2, h: s.h - HEADER_PX - 1 } : s;
    const own = tiles.filter((t) => t.sector === s.data.sector);
    for (const p of squarify(own.map((t) => ({ value: t.marketCap, data: t })), inner)) placed.push({ tile: p.data, rect: p });
  }
  return { tiles: placed, sectors: placedSectors };
}

/** What fits in a tile: the ticker at a size scaled to the tile, and the change underneath when there is room. */
function labelFor(ticker: string, w: number, h: number) {
  const byArea = Math.sqrt(w * h) * 0.17;
  const byWidth = (w - 4) / (0.64 * ticker.length);
  const raw = Math.min(34, byArea, byWidth, h - 3);
  // Small print is better than none on a phone, but below 7px it is only noise.
  const font = Math.max(raw, 7);
  if (raw < 5.5 || w < 16 || h < 10 || font * 0.64 * ticker.length > w - 2 || font > h - 1) return null;
  return { font, showChange: h >= font * 2.4 && w >= 34 };
}

export default function MarketHeatmap({ tiles, sectors, totalMarketCap, linkable }: Props) {
  const [mode, setMode] = useState<Mode>("all");
  const [width, setWidth] = useState<number | null>(null);
  const [activeTicker, setActiveTicker] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const pointer = useRef<string>("mouse");

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = width ? heightFor(width) : 0;
  const layout = useMemo(() => (width ? place(tiles, sectors, mode, width, height) : null), [tiles, sectors, mode, width, height]);
  const open = useMemo(() => new Set(linkable), [linkable]);
  const active = tiles.find((t) => t.ticker === activeTicker) ?? null;

  return (
    <section aria-label="NSE market heatmap">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="How to group the tiles" className="inline-flex rounded-full bg-gray-100 p-1 text-sm font-medium">
          {(
            [
              ["all", "All companies"],
              ["sector", "By sector"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`rounded-full px-4 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                mode === value ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500" aria-hidden="true">
          <span>{`-${COLOR_CAP_PCT}%`}</span>
          <span className="h-2.5 w-36 rounded-full" style={{ background: legendGradient() }} />
          <span>{`+${COLOR_CAP_PCT}%`}</span>
        </div>
      </div>

      <div
        ref={box}
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ background: GROUND, height: width ? height : undefined, minHeight: width ? undefined : 360 }}
        onMouseLeave={() => setActiveTicker(null)}
      >
        {layout?.sectors.map(({ sector, rect, header }) =>
          header ? (
            <div
              key={sector.sector}
              className="pointer-events-none absolute flex items-center gap-1.5 overflow-hidden whitespace-nowrap px-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-300"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: HEADER_PX }}
            >
              <span className="truncate">{sector.sector}</span>
              <span className="font-normal normal-case tracking-normal text-gray-400 tabular-nums">{fmtChange(sector.changePct)}</span>
            </div>
          ) : null,
        )}

        {layout?.tiles.map(({ tile, rect }) => {
          const label = labelFor(tile.ticker, rect.w, rect.h);
          const isActive = tile.ticker === activeTicker;
          const summary = `${tile.name} (${tile.ticker}), ${fmtChange(tile.changePct)} today, market cap ${fmtCap(tile.marketCap)}`;
          const style = { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
          const className =
            "absolute block text-white focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset";
          const face = (
            <span
              className="absolute inset-[0.5px] flex flex-col items-center justify-center overflow-hidden text-center leading-none transition-[filter] hover:brightness-125"
              style={{ background: heatColor(tile.changePct), boxShadow: isActive ? "inset 0 0 0 2px #fff" : undefined }}
            >
              {label ? (
                <>
                  <span className="font-bold tracking-tight" style={{ fontSize: label.font }}>
                    {tile.ticker}
                  </span>
                  {label.showChange ? (
                    <span className="mt-[0.3em] tabular-nums opacity-90" style={{ fontSize: Math.max(8, label.font * 0.55) }}>
                      {fmtChange(tile.changePct)}
                    </span>
                  ) : null}
                </>
              ) : null}
            </span>
          );
          const events = {
            onMouseEnter: () => setActiveTicker(tile.ticker),
            onFocus: () => setActiveTicker(tile.ticker),
            onPointerDown: (e: React.PointerEvent) => {
              pointer.current = e.pointerType;
            },
          };
          return open.has(tile.ticker) ? (
            <Link
              key={tile.ticker}
              href={`/companies/${tile.ticker.toLowerCase()}`}
              aria-label={summary}
              className={className}
              style={style}
              {...events}
              onClick={(e) => {
                // On a touch screen the first tap shows the details; a second tap opens the page.
                if (pointer.current === "touch" && activeTicker !== tile.ticker) {
                  e.preventDefault();
                  setActiveTicker(tile.ticker);
                }
              }}
            >
              {face}
            </Link>
          ) : (
            <button key={tile.ticker} type="button" aria-label={summary} className={className} style={style} {...events} onClick={() => setActiveTicker(tile.ticker)}>
              {face}
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[4.5rem] rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3" aria-live="polite">
        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div>
              <p className="font-semibold text-gray-900">
                {active.name} <span className="font-normal text-gray-500">({active.ticker})</span>
              </p>
              <p className="text-sm text-gray-500">
                {active.sector} · {((active.marketCap / totalMarketCap) * 100).toFixed(active.marketCap / totalMarketCap < 0.01 ? 2 : 1)}% of the market
              </p>
            </div>
            <dl className="flex gap-6 text-sm tabular-nums">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Price</dt>
                <dd className="font-semibold text-gray-900">KSh {fmtPrice(active.price)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Today</dt>
                <dd className={`font-semibold ${active.changePct > 0 ? "text-emerald-700" : active.changePct < 0 ? "text-red-600" : "text-gray-700"}`}>{fmtChange(active.changePct)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Market cap</dt>
                <dd className="font-semibold text-gray-900">{fmtCap(active.marketCap)}</dd>
              </div>
            </dl>
            {open.has(active.ticker) ? (
              <Link href={`/companies/${active.ticker.toLowerCase()}`} className="text-sm font-semibold text-emerald-700 hover:underline">
                Company profile →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="pt-2 text-sm text-gray-500">Point at a tile, or tap one, to see the company. A bigger tile is a bigger company.</p>
        )}
      </div>
    </section>
  );
}

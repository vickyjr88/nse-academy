import React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePalette } from '../../ui/theme';
import { compact, shortDay, whole } from '../../ui/format';
import { DailyPoint, PeriodSummary, priceAxis } from './period';

export const price = (n: number) => `KSh ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const signedPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;

/** "2026-11-26" -> "Thu, 26 Nov 2026". */
export function fullDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const monthYear = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

// Both panels reserve the same space for the value axis and the same right margin, so a day lines up from one to the other.
const AXIS_W = 52;
const SIDE = { left: 0, right: 16 };
const SYNC = 'stock-price';

function Tip({ active, payload }: any) {
  const p = usePalette();
  const d: DailyPoint | undefined = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  const tone = d.changePct > 0 ? p.success : d.changePct < 0 ? p.danger : p.muted;
  const line = (label: string, value: React.ReactNode, color = p.text) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}>
      <span style={{ color: p.muted }}>{label}</span>
      <strong style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </div>
  );
  return (
    <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,.14)', fontSize: 12, minWidth: 178, display: 'grid', gap: 4 }}>
      <div style={{ color: p.muted }}>{fullDay(d.date)}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: p.text, fontVariantNumeric: 'tabular-nums' }}>{price(d.price)}</div>
      {line('On the day', signedPct(d.changePct), tone)}
      {line('Volume', whole(d.volume))}
    </div>
  );
}

/** A label for the highest or lowest close, pushed inwards when the day sits near either edge. */
function ExtremeLabel({ viewBox, text, below, align }: any) {
  const p = usePalette();
  if (!viewBox) return null;
  const x = viewBox.x + (viewBox.width ?? 0) / 2;
  const y = viewBox.y + (viewBox.height ?? 0) / 2;
  return (
    <text x={x} y={below ? y + 18 : y - 10} textAnchor={align} fill={p.muted} fontSize={11} fontWeight={600} stroke={p.surface} strokeWidth={3} paintOrder="stroke">
      {text}
    </text>
  );
}

export function PriceChart({ days, summary }: { days: DailyPoint[]; summary: PeriodSummary }) {
  const p = usePalette();
  const { domain, ticks, decimals } = priceAxis(summary.low.price, summary.high.price);
  const longSpan = Date.parse(summary.last.date) - Date.parse(summary.first.date) > 200 * 86_400_000;
  const single = days.length === 1;
  const flat = summary.high.price === summary.low.price;

  const align = (date: string) => {
    const at = days.findIndex((d) => d.date === date) / Math.max(1, days.length - 1);
    return at < 0.12 ? 'start' : at > 0.88 ? 'end' : 'middle';
  };
  const mark = (d: DailyPoint, text: string, below: boolean) => (
    <ReferenceDot x={d.date} y={d.price} r={4} fill={p.surface} stroke={p.primary} strokeWidth={2} label={<ExtremeLabel text={`${text} ${d.price.toFixed(2)}`} below={below} align={align(d.date)} />} />
  );

  return (
    <div role="img" aria-label={`Closing price from ${fullDay(summary.first.date)} to ${fullDay(summary.last.date)}: ${price(summary.first.price)} to ${price(summary.last.price)}, ${signedPct(summary.changePct)}. High ${price(summary.high.price)}, low ${price(summary.low.price)}.`}>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <AreaChart data={days} syncId={SYNC} margin={{ top: 16, bottom: 0, ...SIDE }}>
            <defs>
              <linearGradient id="stock-price-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={p.primary} stopOpacity={0.2} />
                <stop offset="100%" stopColor={p.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={p.soft} />
            {/* A band scale, like the bars below, puts each price point over the middle of its volume bar. */}
            <XAxis dataKey="date" scale="band" hide />
            <YAxis domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(decimals)} tick={{ fill: p.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={AXIS_W} />
            <Tooltip content={<Tip />} cursor={{ stroke: p.faint, strokeDasharray: '3 3' }} />
            {!single && <ReferenceLine y={summary.first.price} stroke={p.faint} strokeDasharray="2 5" />}
            {/* Straight segments: a smoothed curve would draw prices the stock never traded at. */}
            <Area type="linear" dataKey="price" stroke={p.primary} strokeWidth={2} strokeLinejoin="round" fill="url(#stock-price-wash)" dot={single ? { r: 5, fill: p.primary, stroke: p.surface, strokeWidth: 2 } : false} activeDot={{ r: 5, fill: p.primary, stroke: p.surface, strokeWidth: 2 }} isAnimationActive={false} />
            {!single && !flat && mark(summary.high, 'High', false)}
            {!single && !flat && mark(summary.low, 'Low', true)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: p.muted, margin: '10px 0 2px 4px' }}>Shares traded</div>
      <div style={{ width: '100%', height: 104 }}>
        <ResponsiveContainer>
          <BarChart data={days} syncId={SYNC} margin={{ top: 4, bottom: 0, ...SIDE }} barCategoryGap={days.length > 60 ? 1 : '24%'}>
            <CartesianGrid vertical={false} stroke={p.soft} />
            <XAxis dataKey="date" tickFormatter={longSpan ? monthYear : shortDay} tick={{ fill: p.faint, fontSize: 11 }} axisLine={{ stroke: p.border }} tickLine={false} minTickGap={32} />
            <YAxis tickFormatter={(v: number) => compact(v)} tick={{ fill: p.faint, fontSize: 11 }} axisLine={false} tickLine={false} width={AXIS_W} tickCount={3} />
            {/* The price panel's tooltip carries the volume; this one only draws the shared hover highlight. */}
            <Tooltip content={() => null} cursor={{ fill: p.soft }} />
            <Bar dataKey="volume" fill={p.primary} fillOpacity={0.45} radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

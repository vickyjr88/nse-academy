import React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePalette } from './theme';
import { compact, shortDay, whole } from './format';
import { EmptyState } from './primitives';

export interface Series {
  key: string;
  label: string;
  color?: string;
}

type Datum = Record<string, any>;

function TipBox({ active, payload, label, fmt, labelFmt }: any) {
  const p = usePalette();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: 8, padding: '8px 10px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', fontSize: 12, minWidth: 120 }}>
      <div style={{ color: p.muted, marginBottom: 4 }}>{labelFmt ? labelFmt(label) : label}</div>
      {payload.map((row: any) => (
        <div key={row.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, color: p.text }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: row.color || row.fill, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{row.name}</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt ? fmt(row.value) : whole(row.value)}</strong>
        </div>
      ))}
    </div>
  );
}

const noAxisLine = { stroke: 'transparent' } as const;

/** A smooth filled trend over time. With several series they are stacked. */
export function AreaTrend({ data, series, x = 'day', height = 220, format, xFormat = shortDay, stacked = false }: { data: Datum[]; series: Series[]; x?: string; height?: number; format?: (n: number) => string; xFormat?: (s: string) => string; stacked?: boolean }) {
  const p = usePalette();
  if (!data.length) return <EmptyState title="No data yet" />;
  return (
    <div style={{ width: '100%', height }} role="img" aria-label={`Trend of ${series.map((s) => s.label).join(', ')}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const c = s.color ?? p.series[i % p.series.length];
              return (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid vertical={false} stroke={p.soft} />
          <XAxis dataKey={x} tickFormatter={xFormat} tick={{ fill: p.faint, fontSize: 11 }} axisLine={noAxisLine} tickLine={false} minTickGap={28} />
          <YAxis tickFormatter={(v) => (format ? format(v) : compact(v))} tick={{ fill: p.faint, fontSize: 11 }} axisLine={noAxisLine} tickLine={false} width={format ? 64 : 44} allowDecimals={false} />
          <Tooltip content={<TipBox fmt={format} labelFmt={xFormat} />} cursor={{ stroke: p.border }} />
          {series.map((s, i) => {
            const c = s.color ?? p.series[i % p.series.length];
            return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={c} strokeWidth={2} fill={`url(#g-${s.key})`} stackId={stacked ? 'a' : undefined} dot={false} activeDot={{ r: 4 }} />;
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical bars; several series are stacked. */
export function Bars({ data, series, x = 'name', height = 220, format, xFormat, stacked = false, colorByPoint = false }: { data: Datum[]; series: Series[]; x?: string; height?: number; format?: (n: number) => string; xFormat?: (s: string) => string; stacked?: boolean; colorByPoint?: boolean }) {
  const p = usePalette();
  if (!data.length) return <EmptyState title="No data yet" />;
  return (
    <div style={{ width: '100%', height }} role="img" aria-label={`Bars of ${series.map((s) => s.label).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={p.soft} />
          <XAxis dataKey={x} tickFormatter={xFormat} tick={{ fill: p.faint, fontSize: 11 }} axisLine={noAxisLine} tickLine={false} minTickGap={12} />
          <YAxis tickFormatter={(v) => (format ? format(v) : compact(v))} tick={{ fill: p.faint, fontSize: 11 }} axisLine={noAxisLine} tickLine={false} width={format ? 64 : 44} allowDecimals={false} />
          <Tooltip content={<TipBox fmt={format} labelFmt={xFormat} />} cursor={{ fill: p.surfaceAlt }} />
          {series.map((s, i) => {
            const c = s.color ?? p.series[i % p.series.length];
            return (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={c} radius={stacked ? 0 : [4, 4, 0, 0]} stackId={stacked ? 'a' : undefined}>
                {colorByPoint ? data.map((_, idx) => <Cell key={idx} fill={p.series[idx % p.series.length]} />) : null}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface Slice {
  name: string;
  value: number;
  color?: string;
}

/** A donut with the total in the middle and a legend with each share. */
export function Donut({ data, centerLabel, format = whole, height = 190 }: { data: Slice[]; centerLabel?: string; format?: (n: number) => string; height?: number }) {
  const p = usePalette();
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <EmptyState title="No data yet" />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ width: height, height, position: 'relative', flexShrink: 0 }} role="img" aria-label={data.map((d) => `${d.name} ${d.value}`).join(', ')}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="94%" paddingAngle={data.filter((d) => d.value > 0).length > 1 ? 2 : 0} stroke="none">
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? p.series[i % p.series.length]} />
              ))}
            </Pie>
            <Tooltip content={<TipBox fmt={format} />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: p.text, fontVariantNumeric: 'tabular-nums' }}>{format(total)}</div>
          {centerLabel ? <div style={{ fontSize: 11, color: p.muted }}>{centerLabel}</div> : null}
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8, flex: '1 1 140px', minWidth: 140 }}>
        {data.map((d, i) => (
          <li key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: p.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color ?? p.series[i % p.series.length], flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{d.name}</span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{format(d.value)}</strong>
            <span style={{ color: p.muted, width: 38, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A ranked list with proportional bars: for "top pages", "top sources", "top tickers". */
export function RankBars({ items, format = whole, empty = 'Nothing yet.', onSelect }: { items: { label: string; value: number; sub?: string; id?: string }[]; format?: (n: number) => string; empty?: string; onSelect?: (id: string) => void }) {
  const p = usePalette();
  if (!items.length) return <EmptyState title={empty} />;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
      {items.map((i) => (
        <li key={i.id ?? i.label} style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(i.id ?? i.label)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color: p.text, marginBottom: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.label}>
              {i.label}
              {i.sub ? <span style={{ color: p.muted }}> · {i.sub}</span> : null}
            </span>
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{format(i.value)}</strong>
          </div>
          <div style={{ height: 6, background: p.soft, borderRadius: 999 }}>
            <div style={{ width: `${Math.max(3, (i.value / max) * 100)}%`, height: '100%', background: p.primary, borderRadius: 999, opacity: 0.85 }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Steps that narrow, with the share that carries on from one step to the next. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const p = usePalette();
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const carry = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: p.text, marginBottom: 4 }}>
              <span>{s.label}</span>
              <span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{whole(s.value)}</strong>
                {carry !== null ? <span style={{ color: p.muted }}> · {carry}% of previous step</span> : null}
              </span>
            </div>
            <div style={{ height: 22, background: p.soft, borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(s.value ? 2 : 0, (s.value / top) * 100)}%`, height: '100%', background: p.series[0], opacity: 1 - i * 0.18, borderRadius: 6 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A tiny trend line for a KPI tile: no axes, no tooltip. */
export function Sparkline({ values, color, height = 38 }: { values: number[]; color?: string; height?: number }) {
  const p = usePalette();
  const c = color ?? p.primary;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: '100%', height }} aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.3} />
              <stop offset="100%" stopColor={c} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={c} strokeWidth={1.6} fill="url(#spark)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

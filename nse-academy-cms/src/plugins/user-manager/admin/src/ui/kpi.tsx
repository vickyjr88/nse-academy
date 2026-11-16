import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePalette } from './theme';
import { Card, Skeleton } from './primitives';
import { Sparkline } from './charts';
import { href } from '../sections';

export interface KpiProps {
  label: string;
  value: React.ReactNode;
  /** Percentage change against the previous period; null/undefined hides it. */
  delta?: number | null;
  /** Whether a rise is good news (money, members) or bad news (churn, failures). */
  rise?: 'good' | 'bad' | 'neutral';
  deltaNote?: string;
  /** A short line under the number. */
  hint?: React.ReactNode;
  spark?: number[];
  /** A page under the plugin to open when the tile is clicked ("revenue"). */
  to?: string;
}

/** One headline figure: the number, how it moved, and a trend line. */
export function Kpi({ label, value, delta, rise = 'good', deltaNote = 'vs previous period', hint, spark, to }: KpiProps) {
  const p = usePalette();
  const navigate = useNavigate();
  const up = (delta ?? 0) > 0;
  const flat = delta === 0;
  const good = flat || rise === 'neutral' ? null : rise === 'good' ? up : !up;
  const tone = good === null ? p.muted : good ? p.success : p.danger;
  const open = to ? () => navigate(href(to)) : undefined;
  return (
    <Card
      $pad={16}
      onClick={open}
      onKeyDown={open ? (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && open() : undefined}
      role={open ? 'link' : undefined}
      tabIndex={open ? 0 : undefined}
      style={{ cursor: open ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ fontSize: 13, color: p.muted }}>{label}</div>
      <div style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 700, color: p.text, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 12, color: p.muted, minHeight: 18, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {delta !== null && delta !== undefined ? (
          <>
            <span style={{ color: tone, fontWeight: 600 }}>
              {flat ? '–' : up ? '▲' : '▼'} {Math.abs(delta)}%
            </span>
            <span>{deltaNote}</span>
          </>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
      {spark && spark.length > 1 ? <div style={{ marginTop: 4 }}><Sparkline values={spark} color={good === false ? p.danger : undefined} /></div> : null}
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card $pad={16}>
      <Skeleton $h={12} $w="45%" />
      <div style={{ height: 10 }} />
      <Skeleton $h={28} $w="60%" />
      <div style={{ height: 10 }} />
      <Skeleton $h={34} />
    </Card>
  );
}

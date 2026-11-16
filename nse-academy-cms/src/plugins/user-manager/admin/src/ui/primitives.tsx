import React from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { usePalette } from './theme';
import { BASE } from '../sections';

export const Stack = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap = 16 }) => $gap}px;
`;

export const Row = styled.div<{ $gap?: number; $wrap?: boolean; $align?: string; $justify?: string }>`
  display: flex;
  flex-wrap: ${({ $wrap }) => ($wrap ? 'wrap' : 'nowrap')};
  align-items: ${({ $align = 'center' }) => $align};
  justify-content: ${({ $justify = 'flex-start' }) => $justify};
  gap: ${({ $gap = 12 }) => $gap}px;
`;

/** A responsive grid whose columns are at least `$min` px wide. */
export const Grid = styled.div<{ $min?: number; $gap?: number }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${({ $min = 220 }) => $min}px, 1fr));
  gap: ${({ $gap = 16 }) => $gap}px;
`;

/** A two-thirds / one-third split that stacks on narrow screens. */
export const Split = styled.div<{ $ratio?: string }>`
  display: grid;
  grid-template-columns: ${({ $ratio = '2fr 1fr' }) => $ratio};
  gap: 16px;
  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

export const Card = styled.section<{ $pad?: number }>`
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral150};
  border-radius: 10px;
  padding: ${({ $pad = 20 }) => $pad}px;
  min-width: 0;
`;

const H = styled.h2`
  margin: 0;
  font-size: 1.4rem;
  line-height: 1.25;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.neutral800};
`;
const Sub = styled.p`
  margin: 4px 0 0;
  font-size: 1.3rem;
  color: ${({ theme }) => theme.colors.neutral600};
`;

/** The heading of a card: a title, an optional one-line explanation, and anything on the right (a range switch, a link). */
export function CardHead({ title, hint, right }: { title: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Row $justify="space-between" $align="flex-start" $gap={12} style={{ marginBottom: 14 }}>
      <div style={{ minWidth: 0 }}>
        <H>{title}</H>
        {hint ? <Sub>{hint}</Sub> : null}
      </div>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </Row>
  );
}

const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;
export const Skeleton = styled.div<{ $h?: number; $w?: string }>`
  height: ${({ $h = 16 }) => $h}px;
  width: ${({ $w = '100%' }) => $w};
  border-radius: 6px;
  background: linear-gradient(90deg, ${({ theme }) => theme.colors.neutral150} 25%, ${({ theme }) => theme.colors.neutral100} 37%, ${({ theme }) => theme.colors.neutral150} 63%);
  background-size: 400% 100%;
  animation: ${shimmer} 1.4s ease infinite;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

type Tone = 'neutral' | 'success' | 'danger' | 'warning' | 'primary';

/** A small status label. Colours come from the theme, so it reads in dark mode too. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone | string; children: React.ReactNode }) {
  const p = usePalette();
  const map: Record<string, [string, string]> = {
    neutral: [p.surfaceAlt, p.muted],
    success: [p.successSoft, p.success],
    ok: [p.successSoft, p.success],
    good: [p.successSoft, p.success],
    danger: [p.dangerSoft, p.danger],
    bad: [p.dangerSoft, p.danger],
    failing: [p.dangerSoft, p.danger],
    overdue: [p.dangerSoft, p.danger],
    warning: [p.warningSoft, p.warning],
    warn: [p.warningSoft, p.warning],
    primary: [p.primarySoft, p.primary],
    'no-data': [p.primarySoft, p.primary],
  };
  const [bg, fg] = map[tone] ?? map.neutral;
  return <span style={{ background: bg, color: fg, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  const p = usePalette();
  return (
    <div style={{ padding: '28px 12px', textAlign: 'center', color: p.muted }}>
      <div style={{ fontWeight: 600, color: p.text, marginBottom: 4 }}>{title}</div>
      {children ? <div style={{ fontSize: 13 }}>{children}</div> : null}
    </div>
  );
}

const Seg = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 8px;
  overflow: hidden;
`;
const SegBtn = styled.button<{ $on: boolean }>`
  border: 0;
  padding: 5px 12px;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  color: ${({ $on, theme }) => ($on ? theme.colors.primary700 : theme.colors.neutral600)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary100 : 'transparent')};
  &:hover {
    background: ${({ theme }) => theme.colors.neutral100};
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: -2px;
  }
`;

/** A compact switch between a few options, such as 7 / 30 / 90 days. */
export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <Seg role="group" aria-label={label}>
      {options.map((o) => (
        <SegBtn key={String(o.value)} type="button" $on={o.value === value} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </SegBtn>
      ))}
    </Seg>
  );
}

export const RANGE_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

/** A text link to another admin page, given a path under the plugin ("members/advisors"). */
export function GoLink({ to, children }: { to: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const p = usePalette();
  return (
    <a
      href={`${BASE}/${to}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`${BASE}/${to}`);
      }}
      style={{ color: p.primary, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
    >
      {children}
    </a>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Button } from '@strapi/design-system';
import { usePalette } from '../../ui/theme';
import { PLATFORM_ORDER } from './types';

const SHORT: Record<string, string> = { x: 'X', facebook: 'Fb', instagram: 'Ig', threads: 'Th', tiktok: 'Tk' };

/** A small tinted square with the platform's initials. Colour is only a hint; the label always sits next to it. */
export function PlatformMark({ platform, size = 30 }: { platform: string; size?: number }) {
  const p = usePalette();
  const i = Math.max(0, PLATFORM_ORDER.indexOf(platform));
  const color = i === 0 ? p.text : p.series[(i - 1) % p.series.length];
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        fontSize: size * 0.4,
        fontWeight: 700,
        color,
        background: p.surfaceAlt,
        border: `1px solid ${p.border}`,
      }}
    >
      {SHORT[platform] ?? platform.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** A themed native select, so it follows light and dark mode (the old pages hard-coded a grey border). */
export const Select = styled.select`
  height: 40px;
  min-width: 0;
  padding: 0 10px;
  font-size: 1.4rem;
  color: ${({ theme }) => theme.colors.neutral800};
  background: ${({ theme }) => theme.colors.neutral0};
  border: 1px solid ${({ theme }) => theme.colors.neutral200};
  border-radius: 4px;
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary600};
    outline-offset: 1px;
  }
`;

export const FieldLabel = styled.div`
  font-size: 1.2rem;
  font-weight: 600;
  padding-bottom: 4px;
  color: ${({ theme }) => theme.colors.neutral800};
`;

export const CheckRow = styled.label<{ $on?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.4rem;
  color: ${({ theme }) => theme.colors.neutral800};
  border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary600 : theme.colors.neutral200)};
  background: ${({ $on, theme }) => ($on ? theme.colors.primary100 : 'transparent')};
  input {
    margin: 0;
  }
`;

/** A destructive or publishing button that asks once more before it acts, instead of a browser pop-up. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant = 'danger-light',
  confirmVariant = 'danger',
  disabled,
  loading,
  size = 'S',
}: {
  label: React.ReactNode;
  confirmLabel: React.ReactNode;
  onConfirm: () => void;
  variant?: string;
  confirmVariant?: string;
  disabled?: boolean;
  loading?: boolean;
  size?: 'S' | 'M' | 'L';
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const arm = () => {
    setArmed(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setArmed(false), 5000);
  };
  if (armed) {
    return (
      <Button size={size} variant={confirmVariant as any} disabled={disabled} loading={loading} onClick={() => { clearTimeout(timer.current); setArmed(false); onConfirm(); }} onBlur={() => setArmed(false)} autoFocus>
        {confirmLabel}
      </Button>
    );
  }
  return (
    <Button size={size} variant={variant as any} disabled={disabled} loading={loading} onClick={arm}>
      {label}
    </Button>
  );
}

export const tabButtonLabel = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** "12 Nov, 14:05" in Nairobi time, for a post or a test. */
export function stamp(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Nairobi' });
}

export const todayNairobi = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });

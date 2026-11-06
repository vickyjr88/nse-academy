import React from 'react';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';

/** Calls the NSE API as the admin and returns parsed JSON, throwing the API's own message on failure. */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${NSE_API_URL}${path}`, {
    ...init,
    headers: { 'x-admin-key': NSE_ADMIN_KEY, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const kes = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;
export const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : '-');

const PILL: Record<string, { bg: string; fg: string }> = {
  ok: { bg: '#eafbe7', fg: '#2f6846' },
  good: { bg: '#eafbe7', fg: '#2f6846' },
  failing: { bg: '#fcecea', fg: '#b72b1a' },
  overdue: { bg: '#fcecea', fg: '#b72b1a' },
  bad: { bg: '#fcecea', fg: '#b72b1a' },
  'no-data': { bg: '#f0f0ff', fg: '#4945ff' },
  warn: { bg: '#fdf4dc', fg: '#8a5a00' },
  neutral: { bg: '#eaeaef', fg: '#32324d' },
};

export function Pill({ kind = 'neutral', children }: { kind?: string; children: React.ReactNode }) {
  const c = PILL[kind] ?? PILL.neutral;
  return (
    <span style={{ background: c.bg, color: c.fg, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

/** A labelled number for the summary rows at the top of a page. */
export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 160px', padding: '14px 16px', border: '1px solid #dcdce4', borderRadius: 4, background: '#fff' }}>
      <div style={{ fontSize: 12, color: '#666687', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#32324d', padding: '2px 0' }}>{value}</div>
      {note ? <div style={{ fontSize: 12, color: '#666687' }}>{note}</div> : null}
    </div>
  );
}

import React from 'react';
import { SingleSelect, Textarea, TextInput } from '@strapi/design-system';
import { NSE_API_URL, NSE_ADMIN_KEY } from '../index';
import { Badge, Card } from '../ui/primitives';

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

/** A status label. Colours come from the admin theme (see ui/primitives), so it is readable in dark mode too. */
export function Pill({ kind = 'neutral', children }: { kind?: string; children: React.ReactNode }) {
  return <Badge tone={kind}>{children}</Badge>;
}

/** A labelled number for the summary rows at the top of a page. */
export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <Card $pad={14} style={{ flex: '1 1 160px' }}>
      <div style={{ fontSize: 12, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, padding: '2px 0' }}>{value}</div>
      {note ? <div style={{ fontSize: 12, opacity: 0.7 }}>{note}</div> : null}
    </Card>
  );
}

// This design-system version has no `label` prop on inputs (labels come from Field.Root), so these add a visible label
// above the plain control and keep it as the accessible name.
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, paddingBottom: 4 };

export function LTextInput({ label, ...rest }: { label: string; [k: string]: any }) {
  return <div><div style={labelStyle}>{label}</div><TextInput aria-label={label} {...rest} /></div>;
}
export function LTextarea({ label, ...rest }: { label: string; [k: string]: any }) {
  return <div><div style={labelStyle}>{label}</div><Textarea aria-label={label} {...rest} /></div>;
}
export function LSingleSelect({ label, ...rest }: { label: string; [k: string]: any }) {
  return <div><div style={labelStyle}>{label}</div><SingleSelect aria-label={label} {...rest} /></div>;
}

/** Number and money formatting shared by every admin page. */

export const kes = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;

/** 1,234 -> "1.2k"; used on chart axes and big KPI tiles where space is tight. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 10_000) return `${Math.round(n / 1000)}k`;
  if (a >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

export const kesCompact = (n: number) => `KSh ${compact(n)}`;

export const whole = (n: number) => Math.round(n).toLocaleString('en-KE');

/** "2026-11-16" -> "16 Nov". */
export function shortDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const pct = (part: number, whole_: number) => (whole_ > 0 ? Math.round((part / whole_) * 100) : 0);

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** Choosing a stretch of a stock's history and summing it up. Pure, so it can be checked without the admin. */

export interface DailyPoint {
  /** Nairobi calendar date, YYYY-MM-DD. */
  date: string;
  price: number;
  changePct: number;
  volume: number;
}

export const PRESETS = [
  { value: '1W', label: '1W', title: '1 week' },
  { value: '1M', label: '1M', title: '1 month' },
  { value: '3M', label: '3M', title: '3 months' },
  { value: '6M', label: '6M', title: '6 months' },
  { value: 'YTD', label: 'YTD', title: 'Year to date' },
  { value: '1Y', label: '1Y', title: '1 year' },
  { value: 'ALL', label: 'All', title: 'Everything on record' },
  { value: 'CUSTOM', label: 'Custom', title: 'Pick your own dates' },
] as const;

export type Period = (typeof PRESETS)[number]['value'];
export const DEFAULT_PERIOD: Period = '3M';

export const isPeriod = (v: string | null): v is Period => PRESETS.some((p) => p.value === v);

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** The same day `months` earlier; 31 May less 3 months is the last day of February, not early March. */
function monthsBefore(ymd: string, months: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const lastOfTarget = new Date(Date.UTC(y, m - months, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m - 1 - months, Math.min(d, lastOfTarget))));
}

/**
 * The first day a preset asks for, counted back from the latest day on record (not from today, so a weekend or a
 * holiday does not shrink the window). null means no lower limit.
 */
export function presetStart(period: Period, latest: string): string | null {
  switch (period) {
    case '1W': {
      const d = new Date(`${latest}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 7);
      return iso(d);
    }
    case '1M':
      return monthsBefore(latest, 1);
    case '3M':
      return monthsBefore(latest, 3);
    case '6M':
      return monthsBefore(latest, 6);
    case '1Y':
      return monthsBefore(latest, 12);
    case 'YTD':
      return `${latest.slice(0, 4)}-01-01`;
    default:
      return null;
  }
}

/** The days inside the chosen period. Custom dates may be given in either order, and either may be blank. */
export function pickDays(points: DailyPoint[], period: Period, from = '', to = ''): DailyPoint[] {
  if (!points.length) return [];
  if (period === 'CUSTOM') {
    const [a, b] = from && to && from > to ? [to, from] : [from, to];
    return points.filter((p) => (!a || p.date >= a) && (!b || p.date <= b));
  }
  const start = presetStart(period, points[points.length - 1].date);
  return start ? points.filter((p) => p.date >= start) : points;
}

export interface PeriodSummary {
  first: DailyPoint;
  last: DailyPoint;
  /** From the first close shown to the last one shown. */
  change: number;
  changePct: number;
  high: DailyPoint;
  low: DailyPoint;
  avgVolume: number;
  totalVolume: number;
  days: number;
}

export function summarise(days: DailyPoint[]): PeriodSummary | null {
  if (!days.length) return null;
  const first = days[0];
  const last = days[days.length - 1];
  // On a tie the most recent day wins.
  const high = days.reduce((best, d) => (d.price >= best.price ? d : best), first);
  const low = days.reduce((best, d) => (d.price <= best.price ? d : best), first);
  const totalVolume = days.reduce((s, d) => s + d.volume, 0);
  return {
    first,
    last,
    change: last.price - first.price,
    changePct: ((last.price - first.price) / first.price) * 100,
    high,
    low,
    totalVolume,
    avgVolume: totalVolume / days.length,
    days: days.length,
  };
}

/** Round axis limits and evenly spaced ticks with a little air above and below the prices. */
export function priceAxis(min: number, max: number, count = 5): { domain: [number, number]; ticks: number[]; decimals: number } {
  const span = max - min || Math.max(max * 0.02, 0.1);
  const raw = (span * 1.24) / (count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const lo = Math.max(0, Math.floor((min - span * 0.12) / step) * step);
  const hi = Math.ceil((max + span * 0.12) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  const decimals = step >= 1 && Number.isInteger(step) ? 0 : step >= 0.1 && Number.isInteger(Number((step * 10).toFixed(6))) ? 1 : 2;
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks, decimals };
}

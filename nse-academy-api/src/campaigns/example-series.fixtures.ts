import { DailyClose } from '../portfolio-watch/portfolio-watch';

const DAY = 86_400_000;

/** `n` sessions ending 2026-11-05 whose path is flat at `base`, with the given last two closes. */
export function series(n: number, base: number, prev: number, last: number, extra: Partial<Record<'lo' | 'hi', number>> = {}): DailyClose[] {
  const end = Date.parse('2026-11-05T00:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(end - (n - 1 - i) * DAY).toISOString().slice(0, 10);
    let price = base;
    if (i === 3 && extra.hi) price = extra.hi;
    if (i === 5 && extra.lo) price = extra.lo;
    if (i === n - 2) price = prev;
    if (i === n - 1) price = last;
    return { date, price };
  });
}

/** Thursday 5 Nov 2026, the five stocks of the example, with realistic closes and history. */
export function exampleSeries(): Map<string, DailyClose[]> {
  return new Map([
    ['NSE', series(60, 31, 33.65, 33.65, { lo: 24.6, hi: 34.5 })],
    ['KEGN', series(60, 11.5, 9.98, 10, { lo: 9.9, hi: 12.6 })],
    ['UCHM', series(60, 1.4, 1.33, 1.31, { lo: 1.19, hi: 1.63 })],
    ['KPLC', series(60, 22, 21.95, 22, { lo: 20, hi: 24.35 })],
    ['NBV', series(60, 1.3, 1.36, 1.33, { lo: 1.23, hi: 1.39 })],
  ]);
}

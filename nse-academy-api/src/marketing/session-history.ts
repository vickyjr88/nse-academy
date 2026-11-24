/**
 * Turns stored price snapshots into one summary per real trading session, so a post can say how today compares with
 * the past. Pure: the service loads the rows, this only does the sums.
 *
 * Why "real" sessions: the price feed refreshes once a day, around the close. A weekday where it never refreshed (a
 * holiday, or the hours before today's update) holds yesterday's numbers again. Such a day is not a session, and
 * treating it as one would make the morning posts repeat yesterday's figures as if they were new.
 */
import { createHash } from 'crypto';

export interface BarRow {
  /** Nairobi calendar date of the snapshot, YYYY-MM-DD. */
  ymd: string;
  ticker: string;
  name: string;
  price: number;
  /** Shares traded that day (cumulative at the snapshot). */
  volume: number;
  /** The feed's own day change in percent. */
  changePct: number;
}

export interface SessionSummary {
  ymd: string;
  advancers: number;
  decliners: number;
  unchanged: number;
  /** Stocks that traded (volume above zero). */
  traded: number;
  valueKes: number;
  /** Market value of the listed companies we hold share counts for, at the day's prices. */
  capKes: number | null;
  /** The most traded stock and its share of the day's value, in percent. */
  top: { ticker: string; sharePct: number } | null;
}

export interface TickerDay {
  ymd: string;
  price: number;
  valueKes: number;
  changePct: number;
}

export interface SessionHistory {
  /** Oldest first. The last one is the most recent real session. */
  sessions: SessionSummary[];
  series: Map<string, TickerDay[]>;
  names: Record<string, string>;
}

const fingerprint = (rows: BarRow[]) =>
  createHash('md5')
    .update([...rows].sort((a, b) => a.ticker.localeCompare(b.ticker)).map((r) => `${r.ticker}:${r.price}:${r.volume}`).join(','))
    .digest('hex');

export function toSessions(rows: BarRow[], shares: Record<string, number> = {}): SessionHistory {
  const byDay = new Map<string, BarRow[]>();
  for (const r of rows) {
    if (!r.ticker || !(r.price > 0)) continue;
    const list = byDay.get(r.ymd) ?? [];
    list.push(r);
    byDay.set(r.ymd, list);
  }

  const sessions: SessionSummary[] = [];
  const series = new Map<string, TickerDay[]>();
  const names: Record<string, string> = {};
  let previous: string | null = null;

  for (const ymd of [...byDay.keys()].sort()) {
    const day = byDay.get(ymd)!;
    const print = fingerprint(day);
    if (print === previous) continue; // the feed had not refreshed: not a new session
    previous = print;

    const traded = day.filter((r) => r.volume > 0);
    const value = traded.reduce((s, r) => s + r.price * r.volume, 0);
    const top = traded.reduce<BarRow | null>((best, r) => (!best || r.price * r.volume > best.price * best.volume ? r : best), null);
    const capRows = day.filter((r) => shares[r.ticker]);
    sessions.push({
      ymd,
      advancers: traded.filter((r) => r.changePct > 0).length,
      decliners: traded.filter((r) => r.changePct < 0).length,
      unchanged: traded.filter((r) => r.changePct === 0).length,
      traded: traded.length,
      valueKes: Math.round(value),
      capKes: capRows.length ? Math.round(capRows.reduce((s, r) => s + r.price * shares[r.ticker], 0)) : null,
      top: top && value > 0 ? { ticker: top.ticker, sharePct: Math.round(((top.price * top.volume) / value) * 100) } : null,
    });
    for (const r of day) {
      const list = series.get(r.ticker) ?? [];
      list.push({ ymd, price: r.price, valueKes: r.price * r.volume, changePct: r.changePct });
      series.set(r.ticker, list);
      names[r.ticker] = r.name;
    }
  }
  return { sessions, series, names };
}

// ---- small comparisons the posts are built from ------------------------------------------------------------------

export type Direction = 'up' | 'down' | 'flat';

export function directionOf(s: SessionSummary): Direction {
  return s.advancers > s.decliners ? 'up' : s.decliners > s.advancers ? 'down' : 'flat';
}

/** How many of the most recent sessions in a row went the same way as the last one, and what came before the run. */
export function directionRun(sessions: SessionSummary[]): { direction: Direction; length: number; before: { direction: Direction; length: number } | null } {
  if (sessions.length === 0) return { direction: 'flat', length: 0, before: null };
  const dir = directionOf(sessions[sessions.length - 1]);
  let length = 0;
  for (let i = sessions.length - 1; i >= 0 && directionOf(sessions[i]) === dir; i--) length++;
  const rest = sessions.slice(0, sessions.length - length);
  if (rest.length === 0) return { direction: dir, length, before: null };
  const beforeDir = directionOf(rest[rest.length - 1]);
  let beforeLen = 0;
  for (let i = rest.length - 1; i >= 0 && directionOf(rest[i]) === beforeDir; i--) beforeLen++;
  return { direction: dir, length, before: { direction: beforeDir, length: beforeLen } };
}

const BASELINE = 20;

/** Average value traded over up to 20 sessions before the last one, or null with fewer than 5 to compare against. */
export function turnoverBaseline(sessions: SessionSummary[]): { avgKes: number; vsPct: number } | null {
  const last = sessions[sessions.length - 1];
  const earlier = sessions.slice(0, -1).slice(-BASELINE);
  if (!last || earlier.length < 5) return null;
  const avg = earlier.reduce((s, x) => s + x.valueKes, 0) / earlier.length;
  if (avg <= 0) return null;
  return { avgKes: Math.round(avg), vsPct: Math.round((last.valueKes / avg - 1) * 100) };
}

/** Percentage change in market value over the last `n` sessions, or null without enough history. */
export function capChange(sessions: SessionSummary[], n: number): number | null {
  const last = sessions[sessions.length - 1];
  const then = sessions[sessions.length - 1 - n];
  if (!last?.capKes || !then?.capKes) return null;
  return Math.round(((last.capKes / then.capKes - 1) * 100) * 10) / 10;
}

/**
 * How many sessions the last value has been the lowest (or highest) for: the distance back to the nearest earlier value
 * that was as low (or as high). Null when that is under 3 sessions, because that is not worth saying.
 */
export function extremeSpan(values: number[], kind: 'lowest' | 'highest'): number | null {
  if (values.length < 6) return null;
  const lastIndex = values.length - 1;
  const last = values[lastIndex];
  const asExtreme = (v: number) => (kind === 'lowest' ? v <= last : v >= last);
  let span = lastIndex; // extreme across the whole record unless something earlier matches
  for (let i = lastIndex - 1; i >= 0; i--) {
    if (asExtreme(values[i])) {
      span = lastIndex - i;
      break;
    }
  }
  return span >= 3 ? span : null;
}

/** Percentage change of a ticker's close over the last `n` sessions. */
export function tickerChange(days: TickerDay[], n: number): number | null {
  const last = days[days.length - 1];
  const then = days[days.length - 1 - n];
  if (!last || !then || then.price <= 0) return null;
  return Math.round((last.price / then.price - 1) * 1000) / 10;
}

/** Average close of the 20 sessions up to and including the last. */
export function movingAverage(days: TickerDay[], n = BASELINE): number | null {
  const slice = days.slice(-n);
  if (slice.length < 5) return null;
  return slice.reduce((s, d) => s + d.price, 0) / slice.length;
}

/**
 * Sessions since a move at least this large in the same direction last happened for the ticker, counting back from the
 * last day. `null` when it has not happened in the whole record we hold; `count` is then the record's length.
 */
export function sinceBiggerMove(days: TickerDay[], direction: 'up' | 'down'): { sessions: number | null; record: number } {
  const last = days[days.length - 1];
  if (!last) return { sessions: null, record: 0 };
  const size = Math.abs(last.changePct);
  for (let i = days.length - 2; i >= 0; i--) {
    const c = days[i].changePct;
    if ((direction === 'down' ? c <= -size : c >= size)) return { sessions: days.length - 1 - i, record: days.length - 1 };
  }
  return { sessions: null, record: days.length - 1 };
}

/** The `n` most traded tickers of one session. */
export function topByValue(series: Map<string, TickerDay[]>, ymd: string, n: number): { ticker: string; valueKes: number }[] {
  const out: { ticker: string; valueKes: number }[] = [];
  for (const [ticker, days] of series) {
    const d = days.find((x) => x.ymd === ymd);
    if (d && d.valueKes > 0) out.push({ ticker, valueKes: d.valueKes });
  }
  return out.sort((a, b) => b.valueKes - a.valueKes).slice(0, n);
}

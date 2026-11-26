/**
 * Which trading day a price reading belongs to. The feed holds the latest closing prices until it next updates, so
 * anything read before the market opens is the previous session's, however late it arrived. Nairobi is UTC+3 all year.
 */
const EAT_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_MINUTE = 9 * 60 + 30;

const isWeekend = (eat: Date) => eat.getUTCDay() === 0 || eat.getUTCDay() === 6;
const midnightOf = (eat: Date) => Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate());

/** The weekday before the Nairobi day `now` falls on, as YYYY-MM-DD. Holidays are not known here. */
export function previousWeekday(now: Date): string {
  let day = new Date(midnightOf(new Date(now.getTime() + EAT_MS)) - DAY_MS);
  while (isWeekend(day)) day = new Date(day.getTime() - DAY_MS);
  return day.toISOString().slice(0, 10);
}

/**
 * The time to file a reading under. From the open on a weekday it is simply `now`. Before the open, and at weekends, it
 * is late on the previous weekday: from 23:00 Nairobi, after every reading taken that day, so these become its closing
 * prices. Later readings get slightly later times, so the newest one still wins.
 */
export function quoteTimestamp(now: Date): Date {
  const eat = new Date(now.getTime() + EAT_MS);
  if (!isWeekend(eat) && eat.getUTCHours() * 60 + eat.getUTCMinutes() >= OPEN_MINUTE) return now;
  const anchor = Date.parse(`${previousWeekday(now)}T23:00:00+03:00`);
  // Five days of waiting still lands before midnight, so the reading cannot slip into the following day.
  return new Date(anchor + Math.floor((now.getTime() - anchor) / 10_000));
}

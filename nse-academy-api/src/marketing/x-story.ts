/**
 * The words of the hourly posts. Each post looks at the last real session the way a person who follows the market
 * would: what happened, how it compares with the recent past, and what that points to. Every figure is computed from
 * stored prices. Nothing here says why a price moved, predicts one, or recommends anything: a conclusion is only ever
 * a reading of the numbers ("a dip on thin trading", "two stocks were most of the day").
 *
 * Pure: no database, no clock, no model. The same input always gives the same post.
 */
import { cleanName } from '../market-report/market-facts';
import type { Pulse } from './x-slot';
import {
  SessionHistory,
  SessionSummary,
  capChange,
  directionRun,
  extremeSpan,
  movingAverage,
  sinceBiggerMove,
  tickerChange,
  topByValue,
  turnoverBaseline,
} from './session-history';
import type { SlotTemplate } from './x-automation.config';

export interface StoryInput {
  /** Today in Nairobi, YYYY-MM-DD. */
  todayYmd: string;
  history: SessionHistory;
  /** The pulse of the last real session. */
  pulse: Pulse;
  /** Changes day to day so the same template does not read the same every day. */
  seed: number;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekdayName = (ymd: string) => WEEKDAYS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(round1(n))}%`;
const absPct = (n: number) => `${Math.abs(round1(n))}%`;
/** "down 2.4%", "up 1.1%", "flat": how a person says a change. */
const dirPct = (n: number) => (round1(n) === 0 ? 'flat' : `${n < 0 ? 'down' : 'up'} ${absPct(n)}`);
const price = (n: number) => `KSh ${Math.round(n * 100) / 100}`;

export function money(n: number): string {
  if (n >= 1e9) return `KSh ${round1(n / 1e9)}bn`;
  if (n >= 1e8) return `KSh ${Math.round(n / 1e6)}m`;
  if (n >= 1e6) return `KSh ${round1(n / 1e6)}m`;
  if (n >= 1e3) return `KSh ${Math.round(n / 1e3)}k`;
  return `KSh ${Math.round(n)}`;
}

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ordinal = (n: number) => ORDINALS[n] ?? `${n}th`;

const pick = <T>(options: T[], seed: number, salt = 0): T => options[Math.abs(seed + salt) % options.length];

export function isFresh(input: StoryInput): boolean {
  const last = input.history.sessions[input.history.sessions.length - 1];
  return !!last && last.ymd === input.todayYmd;
}

// ---- small pieces -------------------------------------------------------------------------------------------------

function whenOf(input: StoryInput, last: SessionSummary): { day: string; possessive: string } {
  if (isFresh(input)) return { day: 'today', possessive: "today's" };
  const w = weekdayName(last.ymd);
  return { day: `on ${w}`, possessive: `${w}'s` };
}

/** "Equity Bank Ltd" -> "Equity Bank". The legal suffix is noise in a sentence. */
const nameOf = (input: StoryInput, ticker: string) =>
  cleanName(input.history.names[ticker] ?? ticker)
    .replace(/\s+(?:ltd|limited|plc|p\.l\.c\.?)$/i, '')
    .trim();
const label = (input: StoryInput, ticker: string) => `${nameOf(input, ticker)} (${ticker})`;

/** "the third red session in a row" / "the first green session after 3 red ones". */
function runPhrase(sessions: SessionSummary[]): string {
  const run = directionRun(sessions);
  if (run.direction === 'flat') return 'a flat session';
  const word = run.direction === 'down' ? 'red' : 'green';
  if (run.length >= 2) return `the ${ordinal(run.length)} ${word} session in a row`;
  if (run.before && run.before.direction !== 'flat') {
    const before = run.before.direction === 'down' ? 'red' : 'green';
    return `the first ${word} session after ${run.before.length} ${before} ${run.before.length === 1 ? 'one' : 'ones'}`;
  }
  return `a ${word} session`;
}

/** The turnover next to its usual level, and the plain reading of the two together. */
function turnoverLine(sessions: SessionSummary[]): { line: string; reading: string } {
  const last = sessions[sessions.length - 1];
  const base = turnoverBaseline(sessions);
  const run = directionRun(sessions);
  const dir = run.direction;
  if (!base) return { line: `Turnover was ${money(last.valueKes)}.`, reading: '' };
  const vs = base.vsPct;
  const rel = Math.abs(vs) < 5 ? 'in line with the 20-day average' : `${Math.abs(vs)}% ${vs > 0 ? 'above' : 'below'} the 20-day average of ${money(base.avgKes)}`;
  let reading = '';
  if (dir === 'down') reading = vs >= 10 ? 'The selling had volume behind it.' : vs <= -10 ? 'A dip on thin trading.' : '';
  if (dir === 'up') reading = vs >= 10 ? 'The gains came on heavy trading.' : vs <= -10 ? 'A rise on thin trading.' : '';
  return { line: `Turnover was ${money(last.valueKes)}, ${rel}.`, reading };
}

/** Market value of the listed stocks, weighted by size, over a week, with how unusual the level is. */
function capLine(sessions: SessionSummary[]): string {
  const week = capChange(sessions, 5);
  if (week === null) return '';
  const caps = sessions.map((s) => s.capKes).filter((c): c is number => c != null);
  const low = extremeSpan(caps, 'lowest');
  const high = extremeSpan(caps, 'highest');
  const extreme = low ? `, its lowest close in ${low} sessions` : high ? `, its highest close in ${high} sessions` : '';
  return `The NSE's total market value is ${dirPct(week)} over 5 sessions${extreme}.`;
}

/** Joins parts in priority order and drops the last optional ones until it fits. */
export function fit(parts: (string | null | false | undefined)[], limit = 300, required = 2): string {
  const live = parts.filter((p): p is string => !!p && p.trim() !== '').map((p) => p.trim());
  let n = live.length;
  while (n > required && live.slice(0, n).join(' ').length > limit) n--;
  return live.slice(0, n).join(' ');
}

// ---- the posts ----------------------------------------------------------------------------------------------------

function open(input: StoryInput): string | null {
  const { sessions } = input.history;
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const intro = isFresh(input) ? pick(['Morning.', 'Good morning.'], input.seed) : pick(['Morning.', 'Good morning.', 'Habari za asubuhi.', 'Morning all.'], input.seed);
  const t = turnoverLine(sessions);
  return fit([
    isFresh(input) ? intro : `${intro} The NSE opens at 9:30.`,
    `${weekdayName(last.ymd)} closed with ${last.decliners} stocks down and ${last.advancers} up, ${runPhrase(sessions)}.`,
    t.line,
    t.reading,
    capLine(sessions),
  ], 290, 3);
}

function mover(input: StoryInput): string | null {
  const { gainer, loser } = input.pulse;
  const lead = gainer && loser ? (Math.abs(loser.changePct) > Math.abs(gainer.changePct) ? loser : gainer) : (gainer ?? loser);
  if (!lead) return null;
  const sessions = input.history.sessions;
  const last = sessions[sessions.length - 1];
  const { day } = whenOf(input, last);
  const dir = lead.changePct < 0 ? 'down' : 'up';
  const verb = dir === 'down' ? 'fell' : 'rose';
  const days = input.history.series.get(lead.ticker) ?? [];
  const since = sinceBiggerMove(days, dir);
  const noun = dir === 'down' ? 'fall' : 'rise';
  const big =
    since.sessions === null && since.record >= 10
      ? `, its biggest one-day ${noun} in the ${since.record} sessions we track`
      : since.sessions !== null && since.sessions >= 5
        ? `, its biggest one-day ${noun} in ${since.sessions} sessions`
        : '';
  const thin = lead.valueKes < 2_000_000 ? `It only traded ${money(lead.valueKes)}, so one large order can do that.` : `It traded ${money(lead.valueKes)}, so this was not a thin print.`;
  const avg = movingAverage(days);
  const trend = avg ? `The price is now ${absPct((lead.price / avg - 1) * 100)} ${lead.price < avg ? 'below' : 'above'} its 20-day average.` : '';
  return fit([`${lead.ticker} ${verb} ${absPct(lead.changePct)} ${day} to ${price(lead.price)}${big}.`, thin, trend], 290, 2);
}

function breadth(input: StoryInput): string | null {
  // Before the feed refreshes, the opening post has already covered the last session's breadth.
  if (!isFresh(input)) return null;
  const { sessions } = input.history;
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const { day } = whenOf(input, last);
  const prev = sessions[sessions.length - 2];
  const intro = pick(['Breadth check.', 'How wide was the move?', 'A look at the whole market.'], input.seed, 1);
  return fit([
    intro,
    `${last.decliners} stocks fell and ${last.advancers} rose ${day}, with ${last.unchanged} unchanged. That is ${runPhrase(sessions)}.`,
    prev ? `The session before: ${prev.decliners} down, ${prev.advancers} up.` : '',
    capLine(sessions),
  ], 290, 2);
}

function spotlight(input: StoryInput): string | null {
  const s = input.pulse.spotlight;
  if (!s) return null;
  const last = input.history.sessions[input.history.sessions.length - 1];
  const { day } = whenOf(input, last);
  const days = input.history.series.get(s.ticker) ?? [];
  const ch5 = tickerChange(days, 5);
  const ch20 = tickerChange(days, 20);
  const avg = movingAverage(days);
  const share = input.pulse.valueTradedKes > 0 ? Math.round((s.valueKes / input.pulse.valueTradedKes) * 100) : 0;
  const trend =
    ch5 !== null && ch20 !== null
      ? `Over 5 sessions it is ${dirPct(ch5)}, over 20 it is ${dirPct(ch20)}.`
      : ch5 !== null
        ? `Over 5 sessions it is ${dirPct(ch5)}.`
        : '';
  let reading = '';
  if (ch5 !== null && ch20 !== null) {
    if (ch5 > 0 && ch20 < 0) reading = 'A short bounce inside a longer slide.';
    else if (ch5 < 0 && ch20 > 0) reading = 'A short dip inside a longer climb.';
    else if (ch5 < 0 && ch20 < 0) reading = 'Down on both measures.';
    else if (ch5 > 0 && ch20 > 0) reading = 'Up on both measures.';
  }
  const vsAvg = avg ? `It sits ${absPct((s.price / avg - 1) * 100)} ${s.price < avg ? 'below' : 'above'} its 20-day average.` : '';
  const head = `${pick(['Spotlight:', 'One to watch:', 'On my radar:'], input.seed, 2)} ${label(input, s.ticker)}`;
  return fit([
    `${head} closed ${day} at ${price(s.price)}, ${dirPct(s.changePct)}.`,
    trend,
    vsAvg,
    reading,
    share > 0 ? `It had ${share}% of the day's turnover.` : '',
  ], 290, 2);
}

function mostActive(input: StoryInput): string | null {
  const a = input.pulse.active;
  if (!a) return null;
  const { sessions, series } = input.history;
  const last = sessions[sessions.length - 1];
  const { possessive } = whenOf(input, last);
  const days = series.get(a.ticker) ?? [];
  // Its usual share of turnover over the sessions before the last one.
  const earlier = sessions.slice(0, -1).slice(-20);
  const shares = earlier
    .map((s) => {
      const d = days.find((x) => x.ymd === s.ymd);
      return d && s.valueKes > 0 ? (d.valueKes / s.valueKes) * 100 : null;
    })
    .filter((x): x is number => x !== null);
  const usual = shares.length >= 5 ? Math.round(shares.reduce((x, y) => x + y, 0) / shares.length) : null;
  const top = topByValue(series, last.ymd, 2);
  const two = top.length === 2 && last.valueKes > 0 ? Math.round(((top[0].valueKes + top[1].valueKes) / last.valueKes) * 100) : null;
  const lead = pick(['Where the money went.', 'Follow the turnover.'], input.seed, 3);
  return fit([
    `${lead} ${label(input, a.ticker)} took ${a.sharePct}% of ${possessive} ${money(last.valueKes)} turnover.`,
    usual !== null ? `Its usual share is about ${usual}%.` : '',
    two !== null && two >= 50 ? `${top[0].ticker} and ${top[1].ticker} alone were ${two}% of everything traded.` : '',
    `It closed ${dirPct(a.changePct)} at ${price(a.price)}.`,
  ], 290, 2);
}

function close(input: StoryInput): string | null {
  if (!isFresh(input)) return null; // a close is only a close once the feed has refreshed
  const { sessions } = input.history;
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const { gainer, loser } = input.pulse;
  const t = turnoverLine(sessions);
  const lead = pick(['Closing bell.', "That's the bell.", 'NSE done for the day.'], input.seed, 4);
  const thin = (m: { valueKes: number }) => m.valueKes < 1_000_000;
  const plain = (m: { ticker: string; changePct: number }) => `${m.ticker} ${dirPct(m.changePct)}`;
  const withVolume = (m: { ticker: string; changePct: number; valueKes: number }) => `${plain(m)} (${money(m.valueKes)} traded)`;
  const moves =
    gainer && loser
      ? thin(gainer) && thin(loser)
        ? `The biggest moves came on tiny volume: ${withVolume(gainer)} and ${withVolume(loser)}.`
        : `${thin(gainer) ? withVolume(gainer) : plain(gainer)} led the risers, ${thin(loser) ? withVolume(loser) : plain(loser)} the fallers.`
      : gainer
        ? `${thin(gainer) ? withVolume(gainer) : plain(gainer)} led the risers.`
        : loser
          ? `${thin(loser) ? withVolume(loser) : plain(loser)} led the fallers.`
          : '';
  const conc = last.top && last.top.sharePct >= 30 ? `${last.top.ticker} alone was ${last.top.sharePct}% of the value traded.` : '';
  return fit([
    `${lead} ${last.decliners} stocks down, ${last.advancers} up, ${last.unchanged} flat: ${runPhrase(sessions)}.`,
    t.line,
    t.reading,
    moves,
    capLine(sessions),
    conc,
  ], 310, 3);
}

export function storyText(template: SlotTemplate, input: StoryInput): string | null {
  if (input.history.sessions.length === 0) return null;
  if (template === 'session-open') return open(input);
  if (template === 'mover') return mover(input);
  if (template === 'breadth') return breadth(input);
  if (template === 'spotlight') return spotlight(input);
  if (template === 'most-active') return mostActive(input);
  if (template === 'session-close') return close(input);
  // into-the-close: nothing new arrives before the close, so the slot gives way to a lesson rather than repeat the morning.
  return null;
}

/** A lesson, said the way a person would say it, not announced with a label. */
export function lessonText(lesson: string, seed: number, index = 0): string {
  const lead = pick(['Quick one.', 'Worth knowing.', 'Something I keep explaining.', 'A thing people miss.', 'Small tip.'], seed, index * 3 + 5);
  return `${lead} ${lesson.trim()}`;
}

/**
 * Pure clock, due-slot, and copy for the hourly poster. No database and no
 * model calls: the service decides whether a finished draft is worth an AI rewrite.
 */
import { computeMovers, formatCompact, MIN_MOVER_VALUE_KES, PriceRow, toMovers } from '../reports/report-helpers';
import { AutomationConfig, SlotDef, SlotTemplate } from './x-automation.config';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface NairobiClock {
  ymd: string;
  /** 0 = Sunday. */
  weekday: number;
  minuteOfDay: number;
}

export function nairobiClock(now: Date): NairobiClock {
  const eat = new Date(now.getTime() + EAT_OFFSET_MS);
  return {
    ymd: eat.toISOString().slice(0, 10),
    weekday: eat.getUTCDay(),
    minuteOfDay: eat.getUTCHours() * 60 + eat.getUTCMinutes(),
  };
}

/** Minute of the Nairobi day for an instant, so a post at 10:40 can enforce the gap against an 11:00 slot. */
export function nairobiMinuteOfDay(instant: Date): number {
  return nairobiClock(instant).minuteOfDay;
}

export interface SlotState {
  ranSlotIds: string[];
  postsToday: number;
  lastPostMinute: number | null;
}

export type DueSlot = { action: 'idle'; reason: string } | { action: 'fire'; slot: SlotDef };

function fireStart(slot: SlotDef): number | null {
  if (slot.atMinute != null) return slot.atMinute;
  if (slot.hour != null) return slot.hour * 60;
  return null;
}

function windowEnd(slot: SlotDef): number {
  if (slot.atMinute != null) return slot.atMinute + 50;
  return (slot.hour ?? 0) * 60 + 60;
}

/**
 * The slot this minute should attempt. Waiting for prices is not decided here:
 * a fired slot that has no data is left unclaimed so the next minute can try again.
 */
export function dueSlot(config: AutomationConfig, clock: NairobiClock, state: SlotState): DueSlot {
  if (!config.enabled) return { action: 'idle', reason: 'disabled' };
  if (!config.days.includes(clock.weekday)) return { action: 'idle', reason: 'closed' };

  const due = config.slots
    .filter((slot) => {
      if (!slot.enabled || state.ranSlotIds.includes(slot.id)) return false;
      const start = fireStart(slot);
      if (start == null) return false;
      if (slot.atMinute == null && (start < config.startMinute || start > config.endMinute)) return false;
      return clock.minuteOfDay >= start && clock.minuteOfDay < windowEnd(slot);
    })
    .sort((a, b) => fireStart(a)! - fireStart(b)!);

  if (due.length === 0) return { action: 'idle', reason: 'none-due' };
  if (state.postsToday >= config.maxPostsPerDay) return { action: 'idle', reason: 'daily-cap' };
  if (state.lastPostMinute != null && clock.minuteOfDay - state.lastPostMinute < config.minGapMinutes) {
    return { action: 'idle', reason: 'gap' };
  }
  return { action: 'fire', slot: due[0] };
}

export interface Pulse {
  traded: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  valueTradedKes: number;
  gainer: { ticker: string; name: string; changePct: number; price: number; valueKes: number } | null;
  loser: { ticker: string; name: string; changePct: number; price: number; valueKes: number } | null;
  active: { ticker: string; name: string; valueKes: number; sharePct: number; price: number; changePct: number } | null;
  limit: { ticker: string; changePct: number } | null;
  spotlight: { ticker: string; name: string; price: number; changePct: number; valueKes: number } | null;
}

export function spotlightTicker(tickers: string[], ymd: string): string | null {
  const list = tickers.map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (list.length === 0) return null;
  const day = Number(ymd.slice(-2)) || 1;
  return list[(day - 1) % list.length];
}

export function buildPulse(rows: PriceRow[], spotlight: string | null): Pulse {
  const summary = computeMovers(rows);
  const all = toMovers(rows);
  const spot = spotlight ? all.find((m) => m.ticker.toUpperCase() === spotlight.toUpperCase()) : undefined;
  const liquid = all.filter((m) => m.volume > 0 && m.value >= MIN_MOVER_VALUE_KES);
  const limit = liquid
    .filter((m) => Math.abs(m.changePct) >= 9.5)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  const g = summary.gainers[0];
  const l = summary.losers[0];
  const a = summary.active[0];
  return {
    traded: summary.traded,
    advancers: summary.advancers,
    decliners: summary.decliners,
    unchanged: summary.unchanged,
    valueTradedKes: Math.round(summary.totalValue),
    gainer: g ? { ticker: g.ticker, name: g.name, changePct: g.changePct, price: g.price, valueKes: Math.round(g.value) } : null,
    loser: l ? { ticker: l.ticker, name: l.name, changePct: l.changePct, price: l.price, valueKes: Math.round(l.value) } : null,
    active: a
      ? {
          ticker: a.ticker,
          name: a.name,
          valueKes: Math.round(a.value),
          sharePct: summary.totalValue > 0 ? Math.round((a.value / summary.totalValue) * 100) : 0,
          price: a.price,
          changePct: a.changePct,
        }
      : null,
    limit: limit ? { ticker: limit.ticker, changePct: limit.changePct } : null,
    spotlight: spot
      ? { ticker: spot.ticker, name: spot.name, price: spot.price, changePct: spot.changePct, valueKes: Math.round(spot.value) }
      : null,
  };
}

function leadMove(pulse: Pulse): { ticker: string; name: string; changePct: number; price: number; valueKes: number } | null {
  if (pulse.gainer && pulse.loser) {
    return Math.abs(pulse.loser.changePct) > Math.abs(pulse.gainer.changePct) ? pulse.loser : pulse.gainer;
  }
  return pulse.gainer ?? pulse.loser;
}

export interface RenderedSlot {
  text: string;
  /** The session/topic heading, kept separately so an AI rewrite cannot drop it. */
  heading: string;
  fingerprint: string;
  lessonIndex: number | null;
}

/**
 * The heading tells a reader which part of the session and which topic the post
 * belongs to. Templates that name a phase keep their own label; the hourly
 * market slots follow the clock, so moving a slot moves its session.
 */
export function postHeading(slot: SlotDef): string {
  if (slot.template === 'session-open') return 'Opening bell';
  if (slot.template === 'into-the-close') return 'Into the close';
  if (slot.template === 'session-close') return 'Closing bell';
  if (slot.template === 'evening-wrap') return 'Evening wrap';

  const minute = slot.atMinute ?? (slot.hour ?? 0) * 60;
  const session = minute < 12 * 60 ? 'Morning session' : minute < 14 * 60 ? 'Midday session' : minute < 17 * 60 ? 'Afternoon session' : 'Evening session';
  const topic =
    slot.template === 'mover'
      ? 'Movers'
      : slot.template === 'breadth'
        ? 'Breadth'
        : slot.template === 'spotlight'
          ? 'Spotlight'
          : slot.template === 'most-active'
            ? 'Most active'
            : null;
  return topic ? `${session} · ${topic}` : session;
}

/** Put the heading first once. An AI rewrite or an already-labelled report text must not repeat it. */
export function withHeading(heading: string, text: string): string {
  const body = text.trim();
  if (!body) return heading;
  return body.toLowerCase().startsWith(heading.toLowerCase()) ? body : `${heading} — ${body}`;
}

const sgn = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.round(Math.abs(n) * 10) / 10}%`;
const price = (n: number) => `KSh ${Math.round(n * 100) / 100}`;
const kes = (n: number) => `KSh ${formatCompact(n)}`;

/** "33 of the 60 stocks that traded are lower", so breadth is not just two abstract numbers. */
function breadthDetail(pulse: Pulse): string {
  if (pulse.decliners > pulse.advancers) return `${pulse.decliners} of the ${pulse.traded} stocks that traded are lower`;
  if (pulse.advancers > pulse.decliners) return `${pulse.advancers} of the ${pulse.traded} stocks that traded are higher`;
  return `${pulse.traded} stocks traded and risers and fallers are level`;
}

function moversLine(pulse: Pulse): string {
  const parts: string[] = [];
  if (pulse.gainer) parts.push(`top gainer ${pulse.gainer.ticker} ${sgn(pulse.gainer.changePct)} at ${price(pulse.gainer.price)}`);
  if (pulse.loser) parts.push(`weakest ${pulse.loser.ticker} ${sgn(pulse.loser.changePct)} at ${price(pulse.loser.price)}`);
  return parts.length ? ` ${parts.join('; ')}.` : '';
}

function marketText(template: SlotTemplate, pulse: Pulse, shortLabel: string, heading: string): string | null {
  const breadth = `${pulse.advancers} up, ${pulse.decliners} down`;
  let body: string | null = null;

  if (template === 'session-open') {
    const lead = pulse.gainer ? ` ${pulse.gainer.ticker} leads the risers at ${sgn(pulse.gainer.changePct)} (${price(pulse.gainer.price)}).` : '';
    const lag = pulse.loser ? ` ${pulse.loser.ticker} is the weakest at ${sgn(pulse.loser.changePct)}.` : '';
    body =
      `NSE ${shortLabel} opens with ${pulse.advancers} stocks up, ${pulse.decliners} down and ${pulse.unchanged} unchanged. ` +
      `${pulse.traded} stocks have traded, worth about ${kes(pulse.valueTradedKes)} so far.${lead}${lag} ` +
      `Early breadth is a snapshot, not a verdict: it says how many stocks moved, not whether the day will hold.`;
  } else if (template === 'mover') {
    const lead = leadMove(pulse);
    if (!lead) return null;
    const verb = lead.changePct >= 0 ? 'rise' : 'fall';
    body =
      `${lead.ticker} is the biggest ${verb} so far, ${sgn(lead.changePct)} at ${price(lead.price)}, on about ${kes(lead.valueKes)} of traded value. ` +
      `${breadthDetail(pulse)}. The mover list only counts stocks that traded at least KSh 100,000, so a large percentage on tiny volume does not make it. ` +
      `One name moving is not the whole NSE: ${pulse.advancers} stocks are up and ${pulse.decliners} down.`;
  } else if (template === 'breadth') {
    body =
      `${pulse.advancers} NSE stocks are up against ${pulse.decliners} down, with ${pulse.unchanged} unchanged. ` +
      `${pulse.traded} stocks have traded, worth about ${kes(pulse.valueTradedKes)}. ${breadthDetail(pulse)}. ` +
      `Breadth counts stocks, not size: a few large caps can dominate turnover and still leave most names lower.`;
  } else if (template === 'spotlight') {
    if (!pulse.spotlight) return null;
    const s = pulse.spotlight;
    const share = pulse.valueTradedKes > 0 ? Math.round((s.valueKes / pulse.valueTradedKes) * 100) : 0;
    body =
      `${s.ticker} (${s.name}) is at ${price(s.price)}, ${sgn(s.changePct)} on the day, on about ${kes(s.valueKes)} of traded value. ` +
      `That is ${share}% of the ${kes(pulse.valueTradedKes)} traded across the NSE so far. ${breadthDetail(pulse)}. ` +
      `A heavily traded name can set the pace for turnover, but it does not speak for the other ${Math.max(0, pulse.traded - 1)} stocks.`;
  } else if (template === 'most-active') {
    if (!pulse.active) return null;
    const a = pulse.active;
    body =
      `${a.ticker} (${a.name}) has the most value traded so far: about ${kes(a.valueKes)}, ${a.sharePct}% of the ${kes(pulse.valueTradedKes)} that has changed hands across ${pulse.traded} stocks. ` +
      `It is ${sgn(a.changePct)} at ${price(a.price)}. ${breadthDetail(pulse)}. ` +
      `Turnover shows where activity is concentrated; it does not on its own say whether a price is cheap or expensive.`;
  } else if (template === 'into-the-close') {
    const near = pulse.limit ? ` ${pulse.limit.ticker} is at ${sgn(pulse.limit.changePct)} and near the NSE 10% daily limit, which can pause trading in that name.` : '';
    body =
      `${breadth} and ${pulse.unchanged} unchanged. ${pulse.traded} stocks have traded, worth about ${kes(pulse.valueTradedKes)}.${near}` +
      `${moversLine(pulse)} ` +
      `The closing prices are the ones the exchange publishes, so the last stretch matters more than an intraday print.`;
  } else if (template === 'session-close') {
    body =
      `NSE ${shortLabel} closes with ${breadth} and ${pulse.unchanged} unchanged. ` +
      `${pulse.traded} stocks traded, worth about ${kes(pulse.valueTradedKes)}.${moversLine(pulse)} ` +
      `The close is the figure the exchange publishes, and the one to compare with tomorrow's opening range.`;
  }

  return body ? withHeading(heading, body) : null;
}

export function pickLesson(lessons: string[], recentIndexesNewestFirst: number[]): { index: number; text: string } | null {
  if (lessons.length === 0) return null;
  const recent = new Set(recentIndexesNewestFirst);
  const fresh = lessons.findIndex((_, i) => !recent.has(i));
  if (fresh >= 0) return { index: fresh, text: lessons[fresh] };
  const last = recentIndexesNewestFirst[0] ?? 0;
  const index = (last + 1) % lessons.length;
  return { index, text: lessons[index] };
}

export function fillReportPost(xPost: string | undefined, sessionDate: string, siteUrl: string): string | null {
  if (!xPost?.trim()) return null;
  const url = `${siteUrl.replace(/\/$/, '')}/market-report/${sessionDate}`;
  return xPost.split('{URL}').join(url);
}

export function pulseFingerprint(template: SlotTemplate, pulse: Pulse): string {
  if (template === 'mover') {
    const lead = leadMove(pulse);
    return lead ? `${lead.ticker}:${lead.changePct}` : 'none';
  }
  if (template === 'most-active') return pulse.active?.ticker ?? 'none';
  if (template === 'spotlight') return pulse.spotlight ? `${pulse.spotlight.ticker}:${pulse.spotlight.changePct}` : 'none';
  return `${pulse.advancers}:${pulse.decliners}:${pulse.unchanged}:${pulse.limit?.ticker ?? ''}`;
}

function needsMove(template: SlotTemplate, pulse: Pulse, thresholdPct: number): boolean {
  if (template !== 'mover') return true;
  const lead = leadMove(pulse);
  return !!lead && Math.abs(lead.changePct) >= thresholdPct;
}

/**
 * The post for one slot. `{ wait: true }` means the hour is not over and the
 * caller must not claim the slot: prices or the evening report are not in yet.
 */
export function renderSlot(args: {
  template: SlotTemplate;
  heading: string;
  pulse: Pulse | null;
  shortLabel: string;
  thresholdPct: number;
  lesson: { index: number; text: string } | null;
  previousFingerprint: string | null;
  skipIfUnchanged: boolean;
  reportText: string | null;
}): RenderedSlot | { wait: true } {
  if (args.template === 'evening-wrap') {
    if (!args.reportText) return { wait: true };
    return { text: withHeading(args.heading, args.reportText), heading: args.heading, fingerprint: 'wrap', lessonIndex: null };
  }
  if (!args.pulse || args.pulse.traded === 0) return { wait: true };

  const fingerprint = pulseFingerprint(args.template, args.pulse);
  const unchanged = args.skipIfUnchanged && args.previousFingerprint != null && args.previousFingerprint === fingerprint;
  const text = needsMove(args.template, args.pulse, args.thresholdPct)
    ? marketText(args.template, args.pulse, args.shortLabel, args.heading)
    : null;
  if (text && !unchanged) return { text, heading: args.heading, fingerprint, lessonIndex: null };
  if (!args.lesson) {
    if (!text) return { wait: true };
    return { text, heading: args.heading, fingerprint, lessonIndex: null };
  }
  const heading = "Today's lesson";
  return { text: withHeading(heading, args.lesson.text), heading, fingerprint: `lesson:${args.lesson.index}`, lessonIndex: args.lesson.index };
}

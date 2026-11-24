/**
 * Pure clock, due-slot, and copy for the hourly poster. No database and no
 * model calls: the service decides whether a finished draft is worth an AI rewrite.
 */
import { computeMovers, MIN_MOVER_VALUE_KES, PriceRow, toMovers } from '../reports/report-helpers';
import { AutomationConfig, SlotDef, SlotTemplate } from './x-automation.config';
import { StoryInput, isFresh, lessonText, storyText } from './x-story';
import { plainCopy } from './plain-copy';

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
  /** Kept for older screens; posts no longer carry a label in front. */
  heading: string;
  fingerprint: string;
  lessonIndex: number | null;
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
  return plainCopy(xPost.split('{URL}').join(url));
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
  pulse: Pulse | null;
  /** Today and the recent sessions, for the comparisons. Null only when there is no history at all. */
  story: StoryInput | null;
  thresholdPct: number;
  lesson: { index: number; text: string } | null;
  previousFingerprint: string | null;
  skipIfUnchanged: boolean;
  reportText: string | null;
}): RenderedSlot | { wait: true } {
  if (args.template === 'evening-wrap') {
    if (!args.reportText) return { wait: true };
    return { text: args.reportText, heading: '', fingerprint: 'wrap', lessonIndex: null };
  }
  if (!args.pulse || args.pulse.traded === 0) return { wait: true };

  // The closing post is only the close once the feed has refreshed for today. Before that, wait rather than post
  // yesterday's figures as today's.
  if (args.template === 'session-close' && args.story && !isFresh(args.story)) return { wait: true };

  const fingerprint = pulseFingerprint(args.template, args.pulse);
  const unchanged = args.skipIfUnchanged && args.previousFingerprint != null && args.previousFingerprint === fingerprint;
  const text = args.story && needsMove(args.template, args.pulse, args.thresholdPct) ? storyText(args.template, args.story) : null;
  if (text && !unchanged) return { text, heading: '', fingerprint, lessonIndex: null };
  if (!args.lesson) {
    if (!text) return { wait: true };
    return { text, heading: '', fingerprint, lessonIndex: null };
  }
  const seed = args.story?.seed ?? 0;
  return { text: lessonText(args.lesson.text, seed, args.lesson.index), heading: '', fingerprint: `lesson:${args.lesson.index}`, lessonIndex: args.lesson.index };
}

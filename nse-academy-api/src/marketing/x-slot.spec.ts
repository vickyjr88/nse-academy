import { DEFAULT_CONFIG } from './x-automation.config';
import { buildPulse, dueSlot, fillReportPost, nairobiClock, pickLesson, renderSlot, spotlightTicker } from './x-slot';
import { PriceRow } from '../reports/report-helpers';
import { BarRow, toSessions } from './session-history';
import { StoryInput } from './x-story';

const clockAt = (iso: string) => nairobiClock(new Date(iso));
const state = { ranSlotIds: [] as string[], postsToday: 0, lastPostMinute: null as number | null };

describe('nairobiClock', () => {
  it('reads Thursday 09:00 Nairobi from 06:00 UTC', () => {
    expect(clockAt('2026-11-05T06:00:00Z')).toEqual({ ymd: '2026-11-05', weekday: 4, minuteOfDay: 9 * 60 });
  });
});

describe('dueSlot', () => {
  const config = DEFAULT_CONFIG;

  it('stays idle while the feature is off, and on a weekend', () => {
    expect(dueSlot(config, clockAt('2026-11-05T06:30:00Z'), state)).toEqual({ action: 'idle', reason: 'disabled' });
    const enabled = { ...config, enabled: true };
    expect(dueSlot(enabled, clockAt('2026-11-07T06:30:00Z'), state)).toEqual({ action: 'idle', reason: 'closed' });
  });

  it('fires the open slot during the 09:00 hour and the evening wrap at 21:10', () => {
    const enabled = { ...config, enabled: true };
    expect(dueSlot(enabled, clockAt('2026-11-05T06:30:00Z'), state)).toMatchObject({ action: 'fire', slot: { id: 'open' } });
    expect(dueSlot(enabled, clockAt('2026-11-05T18:09:00Z'), state)).toEqual({ action: 'idle', reason: 'none-due' });
    expect(dueSlot(enabled, clockAt('2026-11-05T18:10:00Z'), state)).toMatchObject({ action: 'fire', slot: { id: 'evening-wrap' } });
  });

  it('does not repeat a slot, and holds the next one for the gap and the daily cap', () => {
    const enabled = { ...config, enabled: true };
    const ten = clockAt('2026-11-05T07:05:00Z');
    expect(dueSlot(enabled, ten, { ...state, ranSlotIds: ['mover-am'] })).toEqual({ action: 'idle', reason: 'none-due' });
    expect(dueSlot(enabled, ten, { ...state, postsToday: 8 })).toEqual({ action: 'idle', reason: 'daily-cap' });
    expect(dueSlot(enabled, ten, { ...state, lastPostMinute: 10 * 60 })).toEqual({ action: 'idle', reason: 'gap' });
    expect(dueSlot(enabled, ten, state)).toMatchObject({ action: 'fire', slot: { id: 'mover-am' } });
  });
});

describe('renderSlot', () => {
  /** Eight real sessions of three stocks; the last one is Monday 23 Nov. SCOM drifts down, KCB jumps on the last day. */
  const days = ['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23'];
  const bars: BarRow[] = days.flatMap((ymd, i) => [
    { ymd, ticker: 'SCOM', name: 'Safaricom Ltd Ord 0.05', price: 34 - i * 0.1, volume: 100_000 + i * 1000, changePct: i === 7 ? -0.6 : -0.3 },
    { ymd, ticker: 'KCB', name: 'KCB Group Ltd', price: i === 7 ? 44 : 40, volume: i === 7 ? 80_000 : 50_000, changePct: i === 7 ? 10 : 0.2 },
    { ymd, ticker: 'EQTY', name: 'Equity Bank Ltd Ord 0.50', price: 96, volume: 30_000, changePct: i === 7 ? -2 : 0.1 },
  ]);
  const history = toSessions(bars, { SCOM: 1000, KCB: 1000, EQTY: 1000 });
  const lastRows: PriceRow[] = bars.filter((b) => b.ymd === '2026-11-23').map((b) => ({ ticker: b.ticker, name: b.name, price: b.price, volume: String(b.volume), change: String(b.changePct) }));
  const pulse = buildPulse(lastRows, 'SCOM');
  const story = (todayYmd: string): StoryInput => ({ todayYmd, history, pulse, seed: 7 });
  const base = { pulse, thresholdPct: 3, lesson: { index: 0, text: 'A lesson.' }, previousFingerprint: null as string | null, skipIfUnchanged: true, reportText: null as string | null };

  it('names the mover when the move clears the threshold, and says which day it was', () => {
    const rendered = renderSlot({ ...base, template: 'mover', story: story('2026-11-24') });
    expect(rendered).toMatchObject({ lessonIndex: null });
    const text = 'text' in rendered ? rendered.text : '';
    expect(text).toContain('KCB');
    expect(text).toContain('on Monday');
  });

  it('writes the opening post about the last session, not about today, while the feed has not refreshed', () => {
    const rendered = renderSlot({ ...base, template: 'session-open', story: story('2026-11-24') });
    const text = 'text' in rendered ? rendered.text : '';
    expect(text).toContain('Monday closed with');
    expect(text).toContain('opens at 9:30');
    expect(text).not.toMatch(/\btoday\b/i);
  });

  it('waits for the closing post until the feed has refreshed for today', () => {
    expect(renderSlot({ ...base, template: 'session-close', story: story('2026-11-24') })).toEqual({ wait: true });
    const fresh = renderSlot({ ...base, template: 'session-close', story: story('2026-11-23') });
    expect('text' in fresh && fresh.text).toContain('stocks down');
  });

  it('keeps no heading or label in front of a post', () => {
    for (const template of ['session-open', 'mover', 'spotlight', 'most-active'] as const) {
      const r = renderSlot({ ...base, template, story: story('2026-11-24') });
      const text = 'text' in r ? r.text : '';
      expect(text).not.toMatch(/^(Opening bell|Closing bell|Morning session|Midday session|Afternoon session)/);
      expect(text).not.toMatch(/ \u2014 | \u00B7 /);
    }
  });

  it('uses a lesson when the same breadth was already posted', () => {
    const first = renderSlot({ ...base, template: 'breadth', story: story('2026-11-23'), lesson: null });
    expect('text' in first).toBe(true);
    const again = renderSlot({
      ...base,
      template: 'breadth',
      story: story('2026-11-23'),
      lesson: { index: 2, text: 'Breadth is how many stocks rose.' },
      previousFingerprint: 'fingerprint' in first ? first.fingerprint : null,
    });
    expect(again).toMatchObject({ lessonIndex: 2 });
    expect('text' in again && again.text).toContain('Breadth is how many stocks rose.');
  });

  it('gives the breadth slot to a lesson before the feed refreshes, since the opening post covered it', () => {
    const r = renderSlot({ ...base, template: 'breadth', story: story('2026-11-24'), lesson: { index: 4, text: 'A lesson.' } });
    expect(r).toMatchObject({ lessonIndex: 4 });
  });

  it('waits when there is nothing to say and no lesson to fall back on', () => {
    expect(renderSlot({ ...base, template: 'into-the-close', story: story('2026-11-24'), lesson: null })).toEqual({ wait: true });
    expect(renderSlot({ ...base, template: 'mover', story: story('2026-11-24'), pulse: null })).toEqual({ wait: true });
  });

  it('waits for the evening report instead of claiming an empty wrap', () => {
    expect(renderSlot({ ...base, template: 'evening-wrap', pulse: null, story: null })).toEqual({ wait: true });
    const filled = fillReportPost('NSE today. {URL}', '2026-11-05', 'https://nseacademy.co.ke');
    expect(filled).toBe('NSE today. https://nseacademy.co.ke/market-report/2026-11-05');
  });

  it('takes dashes out of the daily report text too', () => {
    expect(fillReportPost('NSE today \u2014 quiet. {URL}', '2026-11-05', 'https://nseacademy.co.ke')).toBe('NSE today, quiet. https://nseacademy.co.ke/market-report/2026-11-05');
  });

  it('rotates the spotlight by the day of the month and skips a used lesson', () => {
    expect(spotlightTicker(['SCOM', 'EQTY', 'KCB'], '2026-11-05')).toBe('EQTY');
    expect(pickLesson(['a', 'b', 'c'], [0, 1])).toEqual({ index: 2, text: 'c' });
  });
});

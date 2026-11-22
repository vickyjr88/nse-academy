import { DEFAULT_CONFIG } from './x-automation.config';
import { buildPulse, dueSlot, fillReportPost, nairobiClock, pickLesson, renderSlot, spotlightTicker } from './x-slot';
import { PriceRow } from '../reports/report-helpers';

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
  const rows: PriceRow[] = [
    { ticker: 'SCOM', name: 'Safaricom', price: 20, volume: '100000', change: '1.2' },
    { ticker: 'KCB', name: 'KCB', price: 40, volume: '80000', change: '4.5' },
    { ticker: 'EQTY', name: 'Equity', price: 50, volume: '3000', change: '-2' },
  ];
  const pulse = buildPulse(rows, 'SCOM');

  it('names the mover when the move clears the threshold', () => {
    const rendered = renderSlot({
      template: 'mover',
      pulse,
      shortLabel: 'Thu 5 Nov',
      thresholdPct: 3,
      lesson: { index: 0, text: 'A lesson.' },
      previousFingerprint: null,
      skipIfUnchanged: true,
      reportText: null,
    });
    expect(rendered).toMatchObject({ lessonIndex: null });
    expect('text' in rendered && rendered.text).toContain('KCB');
    expect('text' in rendered && rendered.text.length).toBeLessThanOrEqual(280);
  });

  it('uses a lesson when the same breadth was already posted', () => {
    const fingerprint = renderSlot({
      template: 'breadth',
      pulse,
      shortLabel: 'Thu 5 Nov',
      thresholdPct: 3,
      lesson: null,
      previousFingerprint: null,
      skipIfUnchanged: true,
      reportText: null,
    });
    const again = renderSlot({
      template: 'breadth',
      pulse,
      shortLabel: 'Thu 5 Nov',
      thresholdPct: 3,
      lesson: { index: 2, text: 'Breadth is how many stocks rose.' },
      previousFingerprint: 'fingerprint' in fingerprint ? fingerprint.fingerprint : null,
      skipIfUnchanged: true,
      reportText: null,
    });
    expect(again).toMatchObject({ lessonIndex: 2, text: 'Breadth is how many stocks rose.' });
  });

  it('waits for the evening report instead of claiming an empty wrap', () => {
    expect(renderSlot({
      template: 'evening-wrap',
      pulse: null,
      shortLabel: 'Thu 5 Nov',
      thresholdPct: 3,
      lesson: null,
      previousFingerprint: null,
      skipIfUnchanged: true,
      reportText: null,
    })).toEqual({ wait: true });
    const filled = fillReportPost('NSE today. {URL}', '2026-11-05', 'https://nseacademy.co.ke');
    expect(filled).toBe('NSE today. https://nseacademy.co.ke/market-report/2026-11-05');
  });

  it('rotates the spotlight by the day of the month and skips a used lesson', () => {
    expect(spotlightTicker(['SCOM', 'EQTY', 'KCB'], '2026-11-05')).toBe('EQTY');
    expect(pickLesson(['a', 'b', 'c'], [0, 1])).toEqual({ index: 2, text: 'c' });
  });
});

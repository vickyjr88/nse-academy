import { BarRow, toSessions } from './session-history';
import { buildPulse } from './x-slot';
import { hasRoboticPunctuation } from './plain-copy';
import { StoryInput, fit, isFresh, lessonText, money, storyText, weekdayName } from './x-story';
import { SLOT_TEMPLATES } from './x-automation.config';

/** 30 real sessions. Breadth turns red for the last 3; the final day trades thinly; OCH-like stock drops hard on little volume. */
function build(opts: { lastVolumeFactor?: number; thinMover?: boolean } = {}) {
  const dates: string[] = [];
  const d = new Date('2026-10-12T00:00:00Z');
  while (dates.length < 30) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const last = dates.length - 1;
  const bars: BarRow[] = [];
  dates.forEach((ymd, i) => {
    const red = i >= last - 2;
    const factor = i === last ? (opts.lastVolumeFactor ?? 1) : 1;
    for (let k = 0; k < 10; k++) {
      bars.push({ ymd, ticker: `S${k}`, name: `Stock ${k} Ltd`, price: 50 + k + i * 0.01 + (red ? -1 : 0), volume: Math.round((20_000 + k * 500 + i * 13) * factor), changePct: red ? (k < 2 ? 1 : -1) : k < 7 ? 1 : -1 });
    }
    bars.push({ ymd, ticker: 'BIG', name: 'Big Bank Ltd Ord 0.50', price: 100 - (red ? 2 : 0), volume: Math.round(60_000 * factor), changePct: red ? -1.5 : 0.4 });
    bars.push({ ymd, ticker: 'THIN', name: 'Thin Co Plc', price: i === last ? 9.62 : 13, volume: i === last ? 20_000 : 40_000, changePct: i === last ? -7.5 : 0.1 });
  });
  const shares = Object.fromEntries([...Array.from({ length: 10 }, (_, k) => [`S${k}`, 1_000_000]), ['BIG', 5_000_000], ['THIN', 1_000_000]]);
  const history = toSessions(bars, shares);
  const lastYmd = history.sessions[history.sessions.length - 1].ymd;
  const rows = bars.filter((b) => b.ymd === lastYmd).map((b) => ({ ticker: b.ticker, name: b.name, price: b.price, volume: String(b.volume), change: String(b.changePct) }));
  const pulse = buildPulse(rows, 'BIG');
  return { history, pulse, lastYmd, story: (todayYmd: string, seed = 3): StoryInput => ({ todayYmd, history, pulse, seed }) };
}

const NEXT_DAY = (ymd: string) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

describe('storyText', () => {
  const ctx = build();

  it('never uses a long dash, a middle dot or curly punctuation, in any template, fresh or stale', () => {
    for (const seed of [0, 1, 2, 3, 4, 5, 6]) {
      for (const today of [ctx.lastYmd, NEXT_DAY(ctx.lastYmd)]) {
        for (const t of SLOT_TEMPLATES) {
          const text = storyText(t, ctx.story(today, seed));
          if (text) expect(hasRoboticPunctuation(text)).toBe(false);
        }
      }
    }
  });

  it('keeps every post short enough to read, and free of wording the data cannot support', () => {
    const forbidden = /\b(bullish|bearish|rally|rallied|crash\w*|plunge\w*|soar\w*|panic\w*|because of|due to|thanks to|you should|we recommend|will (rise|fall))\b/i;
    for (const seed of [0, 1, 2, 3, 4]) {
      for (const t of SLOT_TEMPLATES) {
        const text = storyText(t, ctx.story(ctx.lastYmd, seed));
        if (!text) continue;
        expect(text.length).toBeLessThanOrEqual(320);
        expect(text).not.toMatch(forbidden);
      }
    }
  });

  it('compares the close with the recent past: a run of red sessions and turnover against its average', () => {
    const text = storyText('session-close', ctx.story(ctx.lastYmd))!;
    expect(text).toContain('third red session in a row');
    expect(text).toMatch(/20-day average/);
    expect(text).toMatch(/total market value is (down|up) /);
  });

  it('reads thin turnover on a down day as thin, and says nothing grander', () => {
    const thin = build({ lastVolumeFactor: 0.4 });
    expect(storyText('session-close', thin.story(thin.lastYmd))).toContain('A dip on thin trading.');
    const heavy = build({ lastVolumeFactor: 2 });
    expect(storyText('session-close', heavy.story(heavy.lastYmd))).toContain('The selling had volume behind it.');
  });

  it('only posts a close once the feed has refreshed for today', () => {
    expect(isFresh(ctx.story(ctx.lastYmd))).toBe(true);
    expect(isFresh(ctx.story(NEXT_DAY(ctx.lastYmd)))).toBe(false);
    expect(storyText('session-close', ctx.story(NEXT_DAY(ctx.lastYmd)))).toBeNull();
  });

  it('names the weekday of the last session before the feed has refreshed, never "today"', () => {
    const stale = ctx.story(NEXT_DAY(ctx.lastYmd));
    const open = storyText('session-open', stale)!;
    expect(open).toContain(`${weekdayName(ctx.lastYmd)} closed with`);
    expect(open).toContain('opens at 9:30');
    expect(storyText('most-active', stale)).toContain(`${weekdayName(ctx.lastYmd)}'s`);
    expect(storyText('breadth', stale)).toBeNull();
  });

  it('puts a big move on thin volume in context instead of presenting it as a verdict', () => {
    const text = storyText('mover', ctx.story(ctx.lastYmd))!;
    expect(text).toContain('THIN fell 7.5%');
    expect(text).toMatch(/only traded KSh \d+k, so one large order can do that/);
    expect(text).toMatch(/biggest one-day fall in the \d+ sessions we track/);
  });

  it('gives into-the-close nothing to say, so a lesson takes the slot', () => {
    expect(storyText('into-the-close', ctx.story(ctx.lastYmd))).toBeNull();
  });

  it('drops the legal suffix from company names and says changes the way people do', () => {
    const text = storyText('most-active', ctx.story(ctx.lastYmd))!;
    expect(text).toContain('Big Bank (BIG)');
    expect(text).not.toMatch(/\bLtd\b|\bPLC\b/);
    expect(text).toMatch(/closed (down|up) /);
  });

  it('returns nothing when there is no history', () => {
    const empty = { todayYmd: '2026-11-24', history: { sessions: [], series: new Map(), names: {} }, pulse: ctx.pulse, seed: 1 };
    expect(storyText('session-open', empty)).toBeNull();
  });
});

describe('helpers', () => {
  it('formats money the way a person would say it', () => {
    expect(money(962_000)).toBe('KSh 962k');
    expect(money(769_000_000)).toBe('KSh 769m');
    expect(money(5_150_000)).toBe('KSh 5.2m');
    expect(money(1_250_000_000)).toBe('KSh 1.3bn');
  });

  it('drops the last optional parts until the post fits, and keeps the required ones', () => {
    expect(fit(['aaaa', 'bbbb', 'cccc'], 9, 1)).toBe('aaaa bbbb');
    expect(fit(['aaaa', 'bbbb', 'cccc'], 3, 2)).toBe('aaaa bbbb');
    expect(fit(['a', '', null, 'b'], 100)).toBe('a b');
  });

  it('opens a lesson in a spoken way, and varies it', () => {
    const leads = new Set([0, 1, 2, 3, 4].map((i) => lessonText('Volume matters.', 1, i).split(' Volume')[0]));
    expect(leads.size).toBeGreaterThan(2);
    expect(lessonText('Volume matters.', 1)).toContain('Volume matters.');
  });
});

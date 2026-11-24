import { BarRow, capChange, directionRun, extremeSpan, movingAverage, sinceBiggerMove, tickerChange, toSessions, topByValue, turnoverBaseline } from './session-history';

const row = (ymd: string, ticker: string, price: number, volume: number, changePct: number): BarRow => ({ ymd, ticker, name: ticker + ' Ltd', price, volume, changePct });
const shares = { AAA: 1000, BBB: 2000 };

/** Three real days, plus a weekday on which the feed did not refresh and repeats the day before. */
const rows: BarRow[] = [
  row('2026-11-18', 'AAA', 10, 100, 1), row('2026-11-18', 'BBB', 20, 50, -1),
  row('2026-11-19', 'AAA', 11, 200, 10), row('2026-11-19', 'BBB', 20, 0, 0),
  row('2026-11-20', 'AAA', 11, 200, 10), row('2026-11-20', 'BBB', 20, 0, 0), // stale repeat of the 19th
  row('2026-11-23', 'AAA', 10, 300, -9), row('2026-11-23', 'BBB', 21, 100, 5),
];

describe('toSessions', () => {
  const h = toSessions(rows, shares);

  it('keeps one summary per real session and skips the day the feed did not refresh', () => {
    expect(h.sessions.map((s) => s.ymd)).toEqual(['2026-11-18', '2026-11-19', '2026-11-23']);
  });

  it('counts breadth only among stocks that traded', () => {
    expect(h.sessions[1]).toMatchObject({ advancers: 1, decliners: 0, unchanged: 0, traded: 1 });
    expect(h.sessions[2]).toMatchObject({ advancers: 1, decliners: 1, traded: 2 });
  });

  it('sums value traded, market value and the biggest stock\'s share', () => {
    expect(h.sessions[0].valueKes).toBe(10 * 100 + 20 * 50);
    expect(h.sessions[0].capKes).toBe(10 * 1000 + 20 * 2000);
    expect(h.sessions[2].top).toEqual({ ticker: 'AAA', sharePct: Math.round((3000 / 5100) * 100) });
  });

  it('builds a per-ticker series without the stale day, and remembers names', () => {
    expect(h.series.get('AAA')!.map((d) => d.ymd)).toEqual(['2026-11-18', '2026-11-19', '2026-11-23']);
    expect(h.names.AAA).toBe('AAA Ltd');
  });

  it('ignores rows with no ticker or no price', () => {
    const g = toSessions([row('2026-11-18', '', 5, 1, 0), row('2026-11-18', 'AAA', 0, 1, 0), row('2026-11-18', 'AAA', 10, 1, 0)]);
    expect(g.sessions).toHaveLength(1);
    expect(g.series.get('AAA')).toHaveLength(1);
  });
});

const s = (advancers: number, decliners: number, valueKes = 1000, capKes: number | null = 1000) => ({ ymd: 'x', advancers, decliners, unchanged: 0, traded: advancers + decliners, valueKes, capKes, top: null });

describe('directionRun', () => {
  it('counts the run and what came before it', () => {
    const run = directionRun([s(10, 5), s(10, 5), s(3, 9), s(3, 9), s(2, 8)]);
    expect(run).toEqual({ direction: 'down', length: 3, before: { direction: 'up', length: 2 } });
  });

  it('handles a single session and an empty list', () => {
    expect(directionRun([s(5, 5)])).toEqual({ direction: 'flat', length: 1, before: null });
    expect(directionRun([]).length).toBe(0);
  });
});

describe('turnoverBaseline', () => {
  it('compares the last session with the 20 before it', () => {
    const list = [...Array.from({ length: 10 }, () => s(5, 5, 100)), s(5, 5, 150)];
    expect(turnoverBaseline(list)).toEqual({ avgKes: 100, vsPct: 50 });
  });

  it('says nothing with fewer than 5 sessions to compare against', () => {
    expect(turnoverBaseline([s(1, 1, 100), s(1, 1, 100), s(1, 1, 200)])).toBeNull();
  });
});

describe('capChange', () => {
  it('measures the change over n sessions to one decimal, or null without history', () => {
    const list = [s(1, 1, 1, 1000), s(1, 1, 1, 1000), s(1, 1, 1, 970)];
    expect(capChange(list, 2)).toBe(-3);
    expect(capChange(list, 5)).toBeNull();
  });
});

describe('extremeSpan', () => {
  it('reports how long the last value has been the lowest, and ignores short runs', () => {
    expect(extremeSpan([5, 4, 3, 6, 5, 4, 3.5, 3.4], 'lowest')).toBe(5);
    expect(extremeSpan([9, 9, 9, 9, 9, 9, 5], 'lowest')).toBe(6);
    expect(extremeSpan([9, 9, 9, 9, 9, 4, 5], 'lowest')).toBeNull();
    expect(extremeSpan([1, 2, 3], 'lowest')).toBeNull();
  });

  it('works for the highest too', () => {
    expect(extremeSpan([1, 1, 1, 1, 1, 1, 9], 'highest')).toBe(6);
  });
});

describe('ticker helpers', () => {
  const days = Array.from({ length: 25 }, (_, i) => ({ ymd: String(i), price: 100 + i, valueKes: 1000 * (i + 1), changePct: i === 10 ? -6 : 1 }));

  it('computes change over a window and a 20-session average', () => {
    expect(tickerChange(days, 5)).toBeCloseTo(((124 / 119) - 1) * 100, 0);
    expect(movingAverage(days)).toBeCloseTo(days.slice(-20).reduce((a, d) => a + d.price, 0) / 20, 5);
    expect(movingAverage(days.slice(0, 3))).toBeNull();
  });

  it('finds when a move this big last happened', () => {
    const fall = [...days.slice(0, 24), { ymd: 'last', price: 90, valueKes: 1, changePct: -7 }];
    expect(sinceBiggerMove(fall, 'down')).toEqual({ sessions: null, record: 24 });
    const smaller = [...days.slice(0, 24), { ymd: 'last', price: 90, valueKes: 1, changePct: -5 }];
    expect(sinceBiggerMove(smaller, 'down')).toEqual({ sessions: 25 - 1 - 10, record: 24 });
  });

  it('ranks tickers by value on one session', () => {
    const series = new Map([
      ['A', [{ ymd: 'd', price: 1, valueKes: 50, changePct: 0 }]],
      ['B', [{ ymd: 'd', price: 1, valueKes: 90, changePct: 0 }]],
      ['C', [{ ymd: 'e', price: 1, valueKes: 999, changePct: 0 }]],
    ]);
    expect(topByValue(series, 'd', 2)).toEqual([{ ticker: 'B', valueKes: 90 }, { ticker: 'A', valueKes: 50 }]);
  });
});

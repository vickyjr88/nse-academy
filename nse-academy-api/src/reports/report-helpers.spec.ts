import { boundsForYmd, computeMovers, eatDayBounds, formatCompact, parseNumber } from './report-helpers';

describe('eatDayBounds', () => {
  it('"yesterday" at 08:00 Nairobi (05:00 UTC) is the previous Nairobi calendar day', () => {
    const d = eatDayBounds(new Date('2026-11-04T05:00:00Z'), 1);
    expect(d.ymd).toBe('2026-11-03');
    expect(d.start.toISOString()).toBe('2026-11-02T21:00:00.000Z'); // 00:00 EAT = 21:00 UTC the day before
    expect(d.end.toISOString()).toBe('2026-11-03T21:00:00.000Z');
    expect(d.label).toBe('Tuesday 3 November 2026');
    expect(d.shortLabel).toBe('Tue 3 Nov');
    expect(d.weekday).toBe(2);
  });

  it('uses the Nairobi date, not the UTC date, just after midnight Nairobi time', () => {
    // 22:30 UTC on 3 Nov is already 01:30 on 4 Nov in Nairobi - so "yesterday" is 3 Nov, not 2 Nov.
    expect(eatDayBounds(new Date('2026-11-03T22:30:00Z'), 1).ymd).toBe('2026-11-03');
  });

  it('a late-evening UTC time that is still "today" in Nairobi does not roll the day early', () => {
    expect(eatDayBounds(new Date('2026-11-03T20:59:00Z'), 1).ymd).toBe('2026-11-02');
  });

  it('boundsForYmd round-trips and rejects bad input', () => {
    expect(boundsForYmd('2026-11-03').start.toISOString()).toBe('2026-11-02T21:00:00.000Z');
    expect(() => boundsForYmd('03/11/2026')).toThrow(/YYYY-MM-DD/);
  });
});

describe('parseNumber', () => {
  it.each([
    ['3.56', 3.56],
    ['-1.89', -1.89],
    ['1,234.5', 1234.5],
    ['5.93 K', 5930],
    ['2.1M', 2100000],
    ['0', 0],
    ['', 0],
    ['n/a', 0],
  ])('parses %p as %p', (raw, expected) => {
    expect(parseNumber(raw)).toBeCloseTo(expected, 5);
  });
});

describe('computeMovers', () => {
  const rows = [
    { ticker: 'AAA', name: 'Alpha', price: 10, volume: '1000', change: '5.00' },
    { ticker: 'BBB', name: 'Beta', price: 20, volume: '500', change: '-3.50' },
    { ticker: 'CCC', name: 'Gamma', price: 1000, volume: '100', change: '1.20' },
    { ticker: 'DDD', name: 'Delta', price: 5, volume: '0', change: '9.99' }, // never traded: stale change must be ignored
    { ticker: 'EEE', name: 'Eps', price: 2, volume: '60000', change: '0.00' },
    { ticker: 'FFF', name: 'Zeta', price: 8, volume: '10', change: '-7.00' },
  ];

  it('ranks gainers and losers by percent change and ignores stocks that did not trade', () => {
    const m = computeMovers(rows, 5, 0);
    expect(m.gainers.map((x) => x.ticker)).toEqual(['AAA', 'CCC']);
    expect(m.losers.map((x) => x.ticker)).toEqual(['FFF', 'BBB']);
    expect(m.gainers.find((x) => x.ticker === 'DDD')).toBeUndefined();
  });

  it('ranks most-active by value traded (price x volume), not raw share count', () => {
    // CCC trades the fewest shares (100) but KSh 100,000; EEE trades 60,000 shares of a KSh 2 stock = KSh 120,000.
    // AAA/BBB are KSh 10,000 each. A share-count ranking would put EEE first and CCC dead last - value puts CCC second.
    const m = computeMovers(rows);
    expect(m.active.map((x) => x.ticker).slice(0, 2)).toEqual(['EEE', 'CCC']);
    expect(m.active.find((x) => x.ticker === 'DDD')).toBeUndefined();
  });

  it('counts breadth only among stocks that traded and respects the top-N cap', () => {
    const m = computeMovers(rows, 1, 0);
    expect(m.advancers).toBe(2);
    expect(m.decliners).toBe(2);
    expect(m.unchanged).toBe(1);
    expect(m.traded).toBe(5);
    expect(m.gainers).toHaveLength(1);
    expect(m.totalValue).toBe(10 * 1000 + 20 * 500 + 1000 * 100 + 2 * 60000 + 8 * 10);
  });

  it('keeps thinly traded stocks out of gainers/losers by default, but still counts them in breadth', () => {
    // AAA trades KSh 10,000 and FFF KSh 80 - below the KSh 100,000 floor. Only CCC (KSh 100,000) qualifies.
    const m = computeMovers(rows);
    expect(m.gainers.map((x) => x.ticker)).toEqual(['CCC']);
    expect(m.losers).toEqual([]);
    expect(m.advancers).toBe(2); // AAA + CCC still count toward market breadth
    expect(m.decliners).toBe(2);
  });

  it('returns empty lists, not an error, for an empty market', () => {
    expect(computeMovers([])).toMatchObject({ gainers: [], losers: [], active: [], traded: 0, totalValue: 0 });
  });
});

describe('formatCompact', () => {
  it('abbreviates thousands, millions and billions', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(48300)).toBe('48.3K');
    expect(formatCompact(1250000)).toBe('1.25M');
    expect(formatCompact(3200000000)).toBe('3.2B');
  });
});

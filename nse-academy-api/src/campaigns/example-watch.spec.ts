import { EXAMPLE_ITEM_LIMIT, EXAMPLE_POSITIONS, buildExampleWatch } from './example-watch';
import { exampleSeries } from './example-series.fixtures';

describe('buildExampleWatch', () => {
  it('values five stocks at the real latest closes and dates the example by them', () => {
    const w = buildExampleWatch(exampleSeries())!;
    expect(w.result.holdings.map((h) => h.ticker).sort()).toEqual(['KEGN', 'KPLC', 'NBV', 'NSE', 'UCHM']);
    expect(w.asOf).toBe('2026-11-05');
    expect(w.asOfLabel).toBe('Thursday 5 November 2026');
    expect(w.result.holdings.find((h) => h.ticker === 'NSE')!.price).toBe(33.65);
  });

  it('sets each position\'s cost so it shows the intended gain or loss today', () => {
    const w = buildExampleWatch(exampleSeries())!;
    for (const p of EXAMPLE_POSITIONS) {
      const h = w.result.holdings.find((x) => x.ticker === p.ticker)!;
      expect(h.gainPct).toBeCloseTo(p.gainPct, 0);
    }
  });

  it('shows the most instructive observations first, capped, using the real rules', () => {
    const w = buildExampleWatch(exampleSeries())!;
    expect(w.items.length).toBeLessThanOrEqual(EXAMPLE_ITEM_LIMIT);
    expect(w.items[0].kind).toBe('TAKE_PROFIT');
    expect(w.items[0].text).toContain('NSE is up 24');
    expect(w.items.map((i) => i.kind)).toContain('DRAWDOWN');
    expect(w.items.every((i) => !/\bsell\b/i.test(i.text))).toBe(true);
  });

  it('is null - so the email goes out without the block - when a stock has no price history', () => {
    const s = exampleSeries();
    s.delete('KPLC');
    expect(buildExampleWatch(s)).toBeNull();
    expect(buildExampleWatch(new Map())).toBeNull();
  });
});

import { buildHeatmap, STALE_AFTER_DAYS } from './heatmap';
import { LISTED_COMPANIES } from './listed-companies';

const now = new Date('2026-11-17T09:00:00Z');
const fresh = new Date('2026-11-16T12:56:00Z');
const q = (ticker: string, price: number, changePct: number, updatedAt = fresh) => ({ ticker, name: ticker + ' plc', price, changePct, updatedAt });
const listed = {
  AAA: { sector: 'Financials', shares: 1_000 },
  BBB: { sector: 'Financials', shares: 3_000 },
  CCC: { sector: 'Utilities', shares: 500 },
};

describe('buildHeatmap', () => {
  it('sizes each tile as price x shares and puts the biggest first', () => {
    const h = buildHeatmap([q('AAA', 10, 1), q('BBB', 10, -1), q('CCC', 10, 0)], now, listed);
    expect(h.tiles.map((t) => [t.ticker, t.marketCap])).toEqual([['BBB', 30_000], ['AAA', 10_000], ['CCC', 5_000]]);
    expect(h.totalMarketCap).toBe(45_000);
  });

  it('weights the market change by size, so a big stock outweighs a small one', () => {
    const h = buildHeatmap([q('AAA', 10, 4), q('BBB', 10, -4)], now, listed);
    // AAA 10k at +4, BBB 30k at -4 => (40k - 120k) / 40k = -2
    expect(h.changePct).toBe(-2);
  });

  it('counts advancers, decliners and unchanged', () => {
    const h = buildHeatmap([q('AAA', 10, 0.4), q('BBB', 10, -0.4), q('CCC', 10, 0)], now, listed);
    expect([h.advancers, h.decliners, h.unchanged]).toEqual([1, 1, 1]);
  });

  it('leaves out tickers with no share count, a blank ticker, zero prices and bad changes', () => {
    const h = buildHeatmap([q('AAA', 10, 1), q('GLD', 5000, 1), q('', 8, -7), q('BBB', 0, 1), q('CCC', 10, NaN)], now, listed);
    expect(h.tiles.map((t) => t.ticker)).toEqual(['AAA']);
  });

  it('leaves out stale quotes (a counter that stopped quoting) but keeps ones inside the window', () => {
    const old = new Date(now.getTime() - (STALE_AFTER_DAYS + 1) * 86_400_000);
    const ok = new Date(now.getTime() - (STALE_AFTER_DAYS - 1) * 86_400_000);
    const h = buildHeatmap([q('AAA', 10, 1, old), q('BBB', 10, 1, ok)], now, listed);
    expect(h.tiles.map((t) => t.ticker)).toEqual(['BBB']);
  });

  it('summarises sectors by size with their own weighted change', () => {
    const h = buildHeatmap([q('AAA', 10, 2), q('BBB', 10, 0), q('CCC', 10, 5)], now, listed);
    expect(h.sectors).toEqual([
      { sector: 'Financials', marketCap: 40_000, changePct: 0.5, count: 2 },
      { sector: 'Utilities', marketCap: 5_000, changePct: 5, count: 1 },
    ]);
  });

  it('reports the newest quote time and survives an empty market', () => {
    expect(buildHeatmap([q('AAA', 10, 1)], now, listed).asOf).toBe(fresh.toISOString());
    const empty = buildHeatmap([], now, listed);
    expect(empty).toMatchObject({ asOf: null, totalMarketCap: 0, changePct: 0, tiles: [], sectors: [] });
  });

  it('ships a share count and sector for every entry in the real table', () => {
    for (const [t, c] of Object.entries(LISTED_COMPANIES)) {
      expect(c.shares).toBeGreaterThan(0);
      expect(c.sector).toBeTruthy();
      expect(t).toMatch(/^[A-Z]{2,6}$/);
    }
  });
});

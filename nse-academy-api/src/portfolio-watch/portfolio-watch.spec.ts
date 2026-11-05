import { DailyClose, WatchPosition, applyCooldowns, consolidate, evaluateWatch } from './portfolio-watch';

// Sessions on consecutive days, oldest first; the last entry is "today".
function closes(prices: number[]): DailyClose[] {
  return prices.map((price, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, price }));
}
/** `n` flat sessions at `base`, then the given tail. */
const flat = (base: number, n: number, ...tail: number[]) => [...Array(n).fill(base), ...tail];

const pos = (ticker: string, quantity: number, avgCost: number | null, costSource: string | null = 'MANUAL'): WatchPosition => ({ ticker, quantity, avgCost, costSource });
const kinds = (r: ReturnType<typeof evaluateWatch>) => r.items.map((i) => `${i.kind}:${i.ticker}`).sort();

describe('consolidate', () => {
  it('merges the same ticker across brokers with a quantity-weighted cost', () => {
    const [p] = consolidate([pos('KNRE', 30000, 4), pos('KNRE', 10000, 6)]);
    expect(p).toMatchObject({ ticker: 'KNRE', quantity: 40000 });
    expect(p.avgCost).toBeCloseTo(4.5, 6);
  });

  it('has no cost for a ticker when any of its holdings has none, and flags an estimated one', () => {
    expect(consolidate([pos('A', 10, 5), pos('A', 10, null, null)])[0].avgCost).toBeNull();
    expect(consolidate([pos('A', 10, 5, 'IMPORT_PRICE')])[0].costSource).toBe('IMPORT_PRICE');
  });

  it('drops empty positions', () => {
    expect(consolidate([pos('A', 0, 5)])).toEqual([]);
  });
});

describe('evaluateWatch - totals', () => {
  it('values the portfolio at the latest close and computes the day change from the previous close', () => {
    const r = evaluateWatch(
      [pos('AAA', 1000, 10), pos('BBB', 500, 20)],
      new Map([
        ['AAA', closes([10, 11])], // +10%: 1,000 sh, +1,000
        ['BBB', closes([20, 20])], // flat
      ]),
    );
    expect(r.valueKes).toBe(11_000 + 10_000);
    expect(r.dayChangeKes).toBeCloseTo(1000, 6);
    expect(r.dayChangePct).toBeCloseTo((1000 / 20_000) * 100, 6);
    expect(r.unrealizedKes).toBe(21_000 - 20_000);
    expect(r.asOf).toBe('2026-10-02');
  });

  it('reports no unrealized total unless every holding has a cost', () => {
    const r = evaluateWatch([pos('AAA', 1000, 10), pos('BBB', 500, null, null)], new Map([['AAA', closes([10, 11])], ['BBB', closes([20, 20])]]));
    expect(r.costKes).toBeNull();
    expect(r.unrealizedKes).toBeNull();
  });

  it('skips tickers with no price history instead of failing', () => {
    const r = evaluateWatch([pos('AAA', 1000, 10), pos('ZZZ', 5, 1)], new Map([['AAA', closes([10, 10])]]));
    expect(r.holdings.map((h) => h.ticker)).toEqual(['AAA']);
  });
});

describe('evaluateWatch - items', () => {
  it('flags a big mover today, in either direction', () => {
    const r = evaluateWatch([pos('UP', 1000, 100), pos('DOWN', 1000, 100)], new Map([['UP', closes([100, 104])], ['DOWN', closes([100, 96])]]));
    expect(kinds(r)).toEqual(['MOVER:DOWN', 'MOVER:UP']);
    expect(r.items.find((i) => i.ticker === 'UP')!.text).toContain('+4.0% today');
    expect(r.items.find((i) => i.ticker === 'DOWN')!.text).toContain('-4.0% today');
  });

  it('does not flag an ordinary day', () => {
    const r = evaluateWatch([pos('AAA', 1000, 100)], new Map([['AAA', closes([100, 101])]]));
    expect(r.items).toEqual([]);
  });

  it('prompts a profit-target check at +20% on cost and says so plainly, without telling anyone to sell', () => {
    const r = evaluateWatch([pos('NSE', 5000, 26.05, 'MANUAL')], new Map([['NSE', closes(flat(33.65, 5))]]));
    const item = r.items.find((i) => i.kind === 'TAKE_PROFIT')!;
    expect(item.text).toContain('up 29.2%');
    expect(item.text).toContain('on your cost');
    expect(item.text).not.toMatch(/\bsell\b/i);
  });

  it('says "estimated" when the cost came from the import-day price', () => {
    const r = evaluateWatch([pos('NSE', 5000, 26.05, 'IMPORT_PRICE')], new Map([['NSE', closes(flat(33.65, 5))]]));
    const item = r.items.find((i) => i.kind === 'TAKE_PROFIT')!;
    expect(item.text).toContain('since your portfolio was imported');
    expect(item.text).toContain('estimated from the price on import day');
    expect(r.costEstimated).toBe(true);
  });

  it('flags a 15% drawdown on cost', () => {
    const r = evaluateWatch([pos('KEGN', 4000, 11.15, 'MANUAL')], new Map([['KEGN', closes(flat(9.2, 5))]]));
    expect(kinds(r)).toContain('DRAWDOWN:KEGN');
  });

  it('flags a close within 2% of the 60-session high or low, only when the range is meaningful', () => {
    const nearHigh = evaluateWatch([pos('H', 1000, null, null)], new Map([['H', closes([...flat(20, 25), ...flat(25, 4), 24.8])]]));
    expect(kinds(nearHigh)).toContain('NEAR_HIGH:H');
    const nearLow = evaluateWatch([pos('L', 1000, null, null)], new Map([['L', closes([...flat(25, 25), ...flat(20, 4), 20.1])]]));
    expect(kinds(nearLow)).toContain('NEAR_LOW:L');
    const narrow = evaluateWatch([pos('N', 1000, null, null)], new Map([['N', closes(flat(100, 30, 100.5))]]));
    expect(kinds(narrow)).toEqual([]);
  });

  it('words it as a new high or low when the close is the extreme, and as "within 2%" when it is merely close', () => {
    const atHigh = evaluateWatch([pos('H', 1000, null, null)], new Map([['H', closes([...flat(20, 25), ...flat(24, 4), 25])]]));
    expect(atHigh.items.find((i) => i.kind === 'NEAR_HIGH')!.text).toContain('its highest close in 30 sessions');
    const close = evaluateWatch([pos('H', 1000, null, null)], new Map([['H', closes([...flat(20, 25), 25, 25, 25, 25, 24.8])]]));
    expect(close.items.find((i) => i.kind === 'NEAR_HIGH')!.text).toContain('within 2% of its 30-session high (KSh 25.00)');
    const atLow = evaluateWatch([pos('L', 1000, null, null)], new Map([['L', closes([...flat(25, 25), ...flat(21, 4), 20])]]));
    expect(atLow.items.find((i) => i.kind === 'NEAR_LOW')!.text).toContain('its lowest close in 30 sessions');
  });

  it('needs enough history before calling anything a high or a low', () => {
    const r = evaluateWatch([pos('NEW', 1000, null, null)], new Map([['NEW', closes([10, 11, 12, 13, 14])]]));
    expect(kinds(r).filter((k) => k.startsWith('NEAR'))).toEqual([]);
  });

  it('flags concentration at 30% with at least three holdings, and not for a one-stock portfolio', () => {
    const many = evaluateWatch(
      [pos('BIG', 1000, null, null), pos('B', 100, null, null), pos('C', 100, null, null)],
      new Map([['BIG', closes([100, 100])], ['B', closes([100, 100])], ['C', closes([100, 100])]]),
    );
    expect(kinds(many)).toEqual(['CONCENTRATION:BIG']);
    expect(many.items[0].text).toContain('83%');
    const single = evaluateWatch([pos('ONLY', 1000, null, null)], new Map([['ONLY', closes([100, 100])]]));
    expect(kinds(single)).toEqual([]);
  });

  it('ignores dust positions', () => {
    const r = evaluateWatch([pos('DUST', 10, 1)], new Map([['DUST', closes([1, 2])]]));
    expect(r.items).toEqual([]);
  });
});

describe('applyCooldowns', () => {
  const now = new Date('2026-11-05T13:30:00Z');
  const day = 86_400_000;
  const items = evaluateWatch([pos('NSE', 5000, 26.05, 'MANUAL'), pos('SCOM', 1000, 30)], new Map([['NSE', closes(flat(33.65, 5))], ['SCOM', closes([30, 31.5])]])).items;

  it('keeps everything that was never sent', () => {
    expect(applyCooldowns(items, new Map(), now)).toHaveLength(items.length);
  });

  it('holds back a take-profit prompt sent yesterday but repeats it after its cooldown', () => {
    const recent = new Map([['TAKE_PROFIT:NSE', new Date(now.getTime() - day)]]);
    expect(applyCooldowns(items, recent, now).map((i) => i.key)).not.toContain('TAKE_PROFIT:NSE');
    const old = new Map([['TAKE_PROFIT:NSE', new Date(now.getTime() - 4 * day)]]);
    expect(applyCooldowns(items, old, now).map((i) => i.key)).toContain('TAKE_PROFIT:NSE');
  });

  it('never suppresses a mover - today\'s move is new information every day', () => {
    const mover = evaluateWatch([pos('SCOM', 1000, null, null)], new Map([['SCOM', closes([100, 105])]])).items;
    expect(applyCooldowns(mover, new Map([['MOVER:SCOM', new Date(now.getTime() - 1000)]]), now)).toHaveLength(1);
  });
});

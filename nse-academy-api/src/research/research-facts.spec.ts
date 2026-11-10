import { MIN_AVG_VALUE_KES, REVIEWER_PLACEHOLDER, StockFacts, computeStockFacts, draftBrief, draftFocusList, screenFocusList } from './research-facts';

const day = (i: number) => new Date(Date.parse('2026-08-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
const bars = (n: number, f: (i: number) => number, value = 10_000_000) => Array.from({ length: n }, (_, i) => ({ date: day(i), price: f(i), valueKes: value }));
const today = day(99);

describe('computeStockFacts', () => {
  it('works out returns, the 60-session range, volatility and liquidity from the bars', () => {
    const f = computeStockFacts('AAA', 'Alpha Ltd', 'Banking Sector', bars(100, (i) => 100 + i * 0.5), today)!;
    expect(f.asOf).toBe(day(99));
    expect(f.price).toBeCloseTo(149.5, 6);
    expect(f.high60).toBeCloseTo(149.5, 6);
    expect(f.fromHighPct).toBeCloseTo(0, 6);
    expect(f.ret3mPct).toBeCloseTo(((149.5 - 104.5) / 104.5) * 100, 4); // 90 days earlier is index 9
    expect(f.ret1mPct).not.toBeNull();
    expect(f.avgDailyValueKes).toBe(10_000_000);
    expect(f.volatilityPct).toBeGreaterThan(0);
  });

  it('refuses a stock with too little history or no recent trading', () => {
    expect(computeStockFacts('AAA', 'A', null, bars(40, () => 10), today)).toBeNull();
    expect(computeStockFacts('AAA', 'A', null, bars(100, () => 10), day(120))).toBeNull();
  });

  it('gives no three-month figure when history does not reach back far enough', () => {
    const f = computeStockFacts('AAA', 'A', null, bars(70, (i) => 10 + i * 0.1), day(69))!;
    expect(f.ret3mPct).toBeNull();
    expect(f.ret1mPct).not.toBeNull();
  });
});

const facts = (over: Partial<StockFacts>): StockFacts => ({ ticker: 'T', name: 'T Ltd', sector: null, asOf: '2026-11-05', price: 50, ret1mPct: 2, ret3mPct: 5, high60: 55, low60: 40, fromHighPct: -9, fromLowPct: 25, volatilityPct: 1.5, avgDailyValueKes: 20_000_000, sessions: 80, ...over });

describe('screenFocusList', () => {
  const universe: StockFacts[] = [
    facts({ ticker: 'MOM1', ret3mPct: 20, fromHighPct: -1, volatilityPct: 2.5 }),
    facts({ ticker: 'MOM2', ret3mPct: 12, fromHighPct: -4, volatilityPct: 2.4 }),
    facts({ ticker: 'MOM3', ret3mPct: 9, fromHighPct: -5, volatilityPct: 2.3 }),
    facts({ ticker: 'PUL1', ret3mPct: -5, fromHighPct: -20, volatilityPct: 2 }),
    facts({ ticker: 'PUL2', ret3mPct: 3, fromHighPct: -12, volatilityPct: 2 }),
    facts({ ticker: 'CALM', ret3mPct: 4, fromHighPct: -3, volatilityPct: 0.6 }),
    facts({ ticker: 'THIN', ret3mPct: 40, fromHighPct: 0, avgDailyValueKes: MIN_AVG_VALUE_KES - 1 }),
    facts({ ticker: 'CRASH', ret3mPct: -35, fromHighPct: -40 }),
  ];

  it('takes the strongest from each screen, never a thinly traded stock, never one stock twice', () => {
    const { picks, universe: n } = screenFocusList(universe);
    expect(n).toBe(7); // THIN is out
    const by = (s: string) => picks.filter((p) => p.screen === s).map((p) => p.ticker);
    expect(by('MOMENTUM')).toEqual(['MOM1', 'MOM2']);
    expect(by('PULLBACK')).toEqual(['PUL1', 'PUL2']);
    expect(by('STEADY')[0]).toBe('CALM');
    expect(new Set(picks.map((p) => p.ticker)).size).toBe(picks.length);
    expect(picks.some((p) => p.ticker === 'THIN' || p.ticker === 'CRASH')).toBe(false);
  });

  it('states each reason with the numbers behind it, and never says buy or sell', () => {
    const { picks } = screenFocusList(universe);
    const mom = picks.find((p) => p.ticker === 'MOM1')!;
    expect(mom.reason).toMatch(/up 20% over three months and closed 1% below its 60-session high/);
    expect(picks.every((p) => !/\b(buy|sell)\b/i.test(p.reason))).toBe(true);
  });

  it('returns nothing when no stock qualifies', () => {
    expect(screenFocusList([facts({ avgDailyValueKes: 10 })]).picks).toEqual([]);
  });
});

describe('drafts', () => {
  const f = facts({ ticker: 'SCOM', name: 'Safaricom Ltd', sector: 'Telecommunications' });

  it('a focus list draft states the method and the criteria, lists each pick, and carries the reviewer placeholder', () => {
    const { picks, universe } = screenFocusList([facts({ ticker: 'MOM1', ret3mPct: 20, fromHighPct: -1 })]);
    const d = draftFocusList('2026-12', picks, [facts({ ticker: 'MOM1', ret3mPct: 20, fromHighPct: -1 })], universe);
    expect(d.slug).toBe('focus-list-2026-12');
    expect(d.title).toBe('Stocks worth researching: December 2026');
    expect(d.body).toContain('Strong recent trend');
    expect(d.body).toContain('not instructions to buy or sell');
    expect(d.body).toContain(REVIEWER_PLACEHOLDER);
    expect(d.tickers).toEqual(['MOM1']);
  });

  it('a brief draft reports the price facts and carries the reviewer placeholder', () => {
    const d = draftBrief(f);
    expect(d.slug).toBe('brief-scom');
    expect(d.body).toContain('Safaricom Ltd (SCOM) is listed in the Telecommunications sector');
    expect(d.body).toContain('KSh 50.00 on 2026-11-05');
    expect(d.body).toContain(REVIEWER_PLACEHOLDER);
  });
});

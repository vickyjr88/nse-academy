import { DayValue, FactsInput, buildFacts, cleanName, kesWords } from './market-facts';

const days = (ticker: string, values: number[], changePct = 0): DayValue[] =>
  values.map((v, i) => ({ ymd: `2026-10-${String(i + 1).padStart(2, '0')}`, value: v, changePct }));

function input(overrides: Partial<FactsInput> = {}): FactsInput {
  return {
    sessionYmd: '2026-11-04',
    label: 'Wednesday 4 November 2026',
    shortLabel: 'Wed 4 Nov',
    weekday: 3,
    rows: [
      { ticker: 'SCOM', name: 'Safaricom', price: 30, volume: '4000000', change: '1.50' }, // 120M
      { ticker: 'KCB', name: 'KCB Group', price: 50, volume: '800000', change: '-2.00' }, // 40M
      { ticker: 'KPC', name: 'Kenya Pipeline', price: 12, volume: '2000000', change: '-10.00' }, // 24M, limit move
      { ticker: 'NCBA', name: 'NCBA Group', price: 90, volume: '100000', change: '4.00' }, // 9M
      { ticker: 'THIN', name: 'Thin Co', price: 400, volume: '100', change: '8.00' }, // 40k - below liquidity floor
      { ticker: 'IDLE', name: 'Idle Co', price: 20, volume: '0', change: '0.00' }, // did not trade
    ],
    history: {
      SCOM: days('SCOM', Array(10).fill(60_000_000)), // today 120M = 2x its baseline -> spike
      KCB: days('KCB', Array(10).fill(40_000_000)), // flat
      KPC: days('KPC', Array(10).fill(30_000_000)),
      NCBA: days('NCBA', Array(10).fill(8_000_000)),
    },
    sectors: { SCOM: 'Telecommunications', KCB: 'Banking', NCBA: 'Banking', KPC: 'Energy' },
    ...overrides,
  };
}

describe('buildFacts', () => {
  const f = buildFacts(input());

  it('counts breadth only among stocks that actually traded', () => {
    expect(f.breadth).toEqual({ advancers: 3, decliners: 2, unchanged: 0, traded: 5 });
  });

  it('keeps thinly traded stocks out of gainers but includes liquid ones, sorted by change', () => {
    expect(f.gainers.map((g) => g.ticker)).toEqual(['NCBA', 'SCOM']);
    expect(f.gainers.find((g) => g.ticker === 'THIN')).toBeUndefined();
    expect(f.losers.map((l) => l.ticker)).toEqual(['KPC', 'KCB']);
  });

  it('ranks most active by value traded and reports concentration of the top stock', () => {
    expect(f.active[0]).toMatchObject({ ticker: 'SCOM', valueKes: 120_000_000 });
    // total = 120M + 40M + 24M + 9M + 40,000 = 193.04M ; SCOM = 62.2%
    expect(f.valueTradedKes).toBe(193_040_000);
    expect(f.concentration).toEqual({ ticker: 'SCOM', name: 'Safaricom', sharePct: 62.2 });
  });

  it('flags a stock trading at 2x+ its own baseline as a volume spike, with the multiple', () => {
    expect(f.volumeSpikes).toEqual([expect.objectContaining({ ticker: 'SCOM', multiple: 2, baselineKes: 60_000_000 })]);
  });

  it('flags moves at the 10% daily limit', () => {
    expect(f.limitMoves).toEqual([{ ticker: 'KPC', name: 'Kenya Pipeline', changePct: -10, price: 12 }]);
  });

  it('computes the total-value comparison against the recent average and the previous session', () => {
    // each prior day totals 60+40+30+8 = 138M ; today 193.04M => +40%
    expect(f.avgValueTradedKes).toBe(138_000_000);
    expect(f.valueVsAvgPct).toBe(40);
    expect(f.previous).toMatchObject({ sessionYmd: '2026-10-10', valueTradedKes: 138_000_000 });
  });

  it('weights sector change by value so a thin stock cannot swing a sector', () => {
    const banking = f.sectors.find((s) => s.sector === 'Banking')!;
    // KCB -2.00 on 40M, NCBA +4.00 on 9M -> (-80 + 36) / 49 = -0.898 -> -0.9
    expect(banking).toMatchObject({ stocks: 2, valueKes: 49_000_000 });
    expect(banking.changePct).toBeCloseTo(-0.9, 1);
    expect(f.sectors[0].sector).toBe('Telecommunications'); // best performer first
  });

  it('leaves out sectors whose stocks barely traded, so one thin stock cannot headline a sector move', () => {
    const f2 = buildFacts(input({
      rows: [
        ...input().rows,
        { ticker: 'TINY', name: 'Tiny Builder', price: 5, volume: '1000', change: '-4.17' }, // KSh 5,000 traded
      ],
      sectors: { SCOM: 'Telecommunications', KCB: 'Banking', NCBA: 'Banking', KPC: 'Energy', TINY: 'Construction & Allied' },
    }));
    expect(f2.sectors.map((s) => s.sector)).not.toContain('Construction & Allied');
    expect(f2.sectors.map((s) => s.sector)).toContain('Banking');
  });

  it('degrades cleanly with no history and no sector data', () => {
    const bare = buildFacts(input({ history: {}, sectors: {} }));
    expect(bare.avgValueTradedKes).toBeNull();
    expect(bare.valueVsAvgPct).toBeNull();
    expect(bare.previous).toBeNull();
    expect(bare.volumeSpikes).toEqual([]);
    expect(bare.sectors).toEqual([]);
    expect(bare.gainers.length).toBeGreaterThan(0); // movers don't depend on history
  });

  it('an empty session yields empty lists and no concentration rather than throwing', () => {
    const empty = buildFacts(input({ rows: [] }));
    expect(empty).toMatchObject({ gainers: [], losers: [], active: [], concentration: null, valueTradedKes: 0 });
  });
});

describe('kesWords', () => {
  it('writes amounts the way the story should say them', () => {
    expect(kesWords(126_025_396)).toBe('KSh 126 million');
    expect(kesWords(372_316_438)).toBe('KSh 372.3 million');
    expect(kesWords(2_500_000_000)).toBe('KSh 2.5 billion');
    expect(kesWords(48_300)).toBe('KSh 48,300');
  });
});

describe('cleanName', () => {
  it.each([
    ['Equity Bank Ltd Ord 0.50', 'Equity Bank Ltd'],
    ['Safaricom Ltd Ord 0.05', 'Safaricom Ltd'],
    ['Olympia Capital Holdings ltd Ord 5.00', 'Olympia Capital Holdings Ltd'],
    ['Car and General (K) Ltd Ord 5.00', 'Car and General (K) Ltd'],
    ['Longhorn Kenya Ltd 1.00', 'Longhorn Kenya Ltd'],
    ['NCBA Ltd 0rd', 'NCBA Ltd'],
    ['Kenya Pipeline Company', 'Kenya Pipeline Company'],
    ['  Stanbic   Holdings  ', 'Stanbic Holdings'],
  ])('%p -> %p', (raw, clean) => {
    expect(cleanName(raw)).toBe(clean);
  });

  it('is applied throughout the facts, so no par value leaks into the page or the AI prompt', () => {
    const f = buildFacts(input({ rows: [{ ticker: 'EQTY', name: 'Equity Bank Ltd Ord 0.50', price: 97.25, volume: '3000000', change: '1.57' }] }));
    expect(JSON.stringify(f)).not.toMatch(/Ord/);
    expect(f.active[0].name).toBe('Equity Bank Ltd');
    expect(f.concentration?.name).toBe('Equity Bank Ltd');
  });
});

describe('valueVsAvgNote', () => {
  it('states the comparison in words so "above" cannot be misread as "of"', () => {
    expect(buildFacts(input()).valueVsAvgNote).toBe('40% above its recent average');
  });
  it('says "below" for a quiet day and is null without history', () => {
    const quiet = buildFacts(input({ history: { SCOM: days('SCOM', Array(10).fill(500_000_000)) } }));
    expect(quiet.valueVsAvgNote).toMatch(/^\d+% below its recent average$/);
    expect(buildFacts(input({ history: {} })).valueVsAvgNote).toBeNull();
  });
});


import { compareToModel, modelPerformance, validateModel, ModelInput } from './models';

const base: ModelInput = {
  slug: 'steady-blue-chips', name: 'Steady blue chips', summary: 'Large, liquid NSE companies.', description: 'For investors who want...', riskProfile: 'conservative', inceptionDate: '2026-09-01',
  holdings: [{ ticker: 'SCOM', weightPct: 40 }, { ticker: 'KCB', weightPct: 35 }, { ticker: 'EQTY', weightPct: 25 }],
};

describe('validateModel', () => {
  it('accepts a well-formed model', () => expect(validateModel(base)).toEqual([]));

  it('explains each thing that is wrong', () => {
    const bad = validateModel({ ...base, slug: 'Bad Slug', name: '', summary: 'x'.repeat(201), description: ' ', riskProfile: 'wild', inceptionDate: '2026-13-45', holdings: [{ ticker: 'SCOM', weightPct: 70 }, { ticker: 'scom', weightPct: 20 }] }).join(' ');
    for (const m of [/address/, /name/, /summary/, /Describe/, /Risk profile/, /real date/, /not a valid stock code/, /1% to 60%/, /add up to 90%/]) expect(bad).toMatch(m);
  });

  it('needs between 2 and 15 stocks', () => {
    expect(validateModel({ ...base, holdings: [{ ticker: 'SCOM', weightPct: 60 }] }).join(' ')).toMatch(/between 2 and 15/);
    const many = Array.from({ length: 16 }, (_, i) => ({ ticker: `T${i}`, weightPct: 6.25 }));
    expect(validateModel({ ...base, holdings: many }).join(' ')).toMatch(/between 2 and 15/);
  });

  it('rejects duplicates and weights that do not sum to exactly 100', () => {
    expect(validateModel({ ...base, holdings: [{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'SCOM', weightPct: 50 }] }).join(' ')).toMatch(/twice/);
    expect(validateModel({ ...base, holdings: [{ ticker: 'SCOM', weightPct: 40 }, { ticker: 'KCB', weightPct: 35 }, { ticker: 'EQTY', weightPct: 24 }] }).join(' ')).toMatch(/exactly 100/);
  });
});

describe('modelPerformance', () => {
  const day = (i: number) => new Date(Date.parse('2026-09-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
  const line = (a: number, b: number, n = 70) => Array.from({ length: n }, (_, i) => ({ date: day(i), price: a + ((b - a) * i) / (n - 1) }));
  const holdings = [{ ticker: 'AAA', weightPct: 60 }, { ticker: 'BBB', weightPct: 40 }];

  it('is the weighted buy-and-hold return since inception, with a 100-based series', () => {
    const p = modelPerformance(holdings, new Map([['AAA', line(10, 12)], ['BBB', line(20, 18)]]), '2026-09-01')!;
    expect(p.sincePct).toBeCloseTo(0.6 * 20 + 0.4 * -10, 6); // +12 - 4
    expect(p.series[0].value).toBeCloseTo(100, 6);
    expect(p.series[p.series.length - 1].value).toBeCloseTo(108, 6);
    expect(p.asOf).toBe(day(69));
    expect(p.last30Pct).not.toBeNull();
    expect(p.series.length).toBeLessThanOrEqual(61);
  });

  it('is null when any holding has no history from inception, rather than showing part of the portfolio', () => {
    expect(modelPerformance(holdings, new Map([['AAA', line(10, 12)]]), '2026-09-01')).toBeNull();
    expect(modelPerformance(holdings, new Map([['AAA', line(10, 12)], ['BBB', line(20, 18).slice(30)]]), '2026-09-01')).toBeNull();
  });

  it('keeps a stock\'s last close on days it did not trade', () => {
    const sparse = line(20, 18).filter((_, i) => i % 5 === 0);
    const p = modelPerformance(holdings, new Map([['AAA', line(10, 12)], ['BBB', sparse]]), '2026-09-01')!;
    expect(p.sincePct).toBeGreaterThan(0);
  });
});

describe('compareToModel', () => {
  it('measures overlap and lists what the member holds that the model does not', () => {
    const c = compareToModel(base.holdings, [{ ticker: 'SCOM', weightPct: 60 }, { ticker: 'KCB', weightPct: 10 }, { ticker: 'KPLC', weightPct: 30 }]);
    expect(c.rows.map((r) => [r.ticker, r.diffPct])).toEqual([['SCOM', 20], ['KCB', -25], ['EQTY', -25]]);
    expect(c.overlapPct).toBe(50); // min(40,60) + min(35,10) + min(25,0)
    expect(c.notInModel).toEqual([{ ticker: 'KPLC', weightPct: 30 }]);
  });
});

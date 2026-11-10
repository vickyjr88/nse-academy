import { allocationRows, consolidatePositions, planRebalance, sectorExposure, validateTargets, Position } from './rebalance';

const pos = (ticker: string, quantity: number, price: number, feePct: number | null = 1.5, brokerName: string | null = 'BrokerA'): Position => ({ ticker, quantity, price, feePct, brokerName });

describe('consolidatePositions / allocationRows', () => {
  it('merges the same stock across brokers; the broker with most shares sets the fee', () => {
    const out = consolidatePositions([
      { ticker: 'KCB', quantity: 100, price: 90, feePct: 2, brokerName: 'Small' },
      { ticker: 'KCB', quantity: 900, price: 90, feePct: 1, brokerName: 'Big' },
      { ticker: 'X', quantity: 0, price: 5, feePct: 1, brokerName: 'Big' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ ticker: 'KCB', quantity: 1000, feePct: 1, brokerName: 'Big' });
  });

  it('weights by value, biggest first, and groups unknown sectors together', () => {
    const rows = allocationRows([pos('SCOM', 1000, 30), pos('KCB', 100, 90), pos('ZZZ', 10, 100)], { SCOM: 'Telecommunications', KCB: 'Banking Sector' });
    expect(rows.map((r) => r.ticker)).toEqual(['SCOM', 'KCB', 'ZZZ']);
    expect(rows[0].weightPct).toBeCloseTo((30_000 / 40_000) * 100, 6);
    const sectors = sectorExposure(rows);
    expect(sectors.map((s) => s.sector)).toEqual(['Telecommunications', 'Banking Sector', 'Unclassified']);
    expect(sectors.reduce((s, x) => s + x.weightPct, 0)).toBeCloseTo(100, 6);
  });
});

describe('validateTargets', () => {
  it('accepts weights that add up to 100 and explains what is wrong otherwise', () => {
    expect(validateTargets([{ ticker: 'SCOM', weightPct: 60 }, { ticker: 'KCB', weightPct: 40 }])).toEqual([]);
    expect(validateTargets([{ ticker: 'SCOM', weightPct: 60 }, { ticker: 'KCB', weightPct: 30 }])[0]).toMatch(/add up to 90%/);
    expect(validateTargets([{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'SCOM', weightPct: 50 }]).join(' ')).toMatch(/twice/);
    expect(validateTargets([{ ticker: 'sc om', weightPct: 100 }])[0]).toMatch(/not a valid stock code/);
    expect(validateTargets([{ ticker: 'SCOM', weightPct: -5 }, { ticker: 'KCB', weightPct: 105 }]).join(' ')).toMatch(/SCOM needs a weight/);
    expect(validateTargets([])).toEqual([]);
  });
});

describe('planRebalance', () => {
  const targets = [{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'KCB', weightPct: 50 }];

  it('proposes nothing while every holding is within the band of its target', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 1000, 30), pos('KCB', 330, 90)], targets }); // 30,000 vs 29,700
    expect(plan.trades).toEqual([]);
    expect(plan.drift.every((d) => Math.abs(d.driftPct) < 2)).toBe(true);
  });

  it('sells the overweight stock and buys the underweight one, sells listed first, with broker costs', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 2000, 30, 1.5, 'A'), pos('KCB', 100, 90, 1, 'B')], targets }); // 60,000 / 9,000
    expect(plan.baseKes).toBe(69_000);
    expect(plan.trades.map((t) => `${t.action} ${t.ticker}`)).toEqual(['SELL SCOM', 'BUY KCB']);
    const sell = plan.trades[0];
    const buy = plan.trades[1];
    expect(sell.shares).toBe(Math.round((60_000 - 34_500) / 30));
    expect(sell.feeKes).toBe(Math.round((sell.valueKes * 1.5) / 100));
    expect(buy.shares).toBe(Math.round((34_500 - 9_000) / 90));
    expect(buy.brokerName).toBe('B');
    expect(plan.totalFeesKes).toBe((sell.feeKes as number) + (buy.feeKes as number));
    expect(Math.abs(plan.netCashKes + plan.totalFeesKes)).toBeLessThan(100); // buys are paid for by sells, give or take rounding to whole shares
  });

  it('never sells more shares than are held', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 10, 30), pos('KCB', 1000, 90)], targets: [{ ticker: 'SCOM', weightPct: 0.5 }, { ticker: 'KCB', weightPct: 99.5 }], minTradeKes: 1 });
    const sell = plan.trades.find((t) => t.action === 'SELL');
    if (sell) expect(sell.shares).toBeLessThanOrEqual(10);
  });

  it('skips trades below the minimum size', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 100, 30), pos('KCB', 10, 90)], targets: [{ ticker: 'SCOM', weightPct: 60 }, { ticker: 'KCB', weightPct: 40 }] }); // 3,000 vs 900: trades of ~KSh 1,000 or less
    for (const t of plan.trades) expect(t.valueKes).toBeGreaterThanOrEqual(1_000);
  });

  it('leaves holdings without a target alone and says so', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 2000, 30), pos('KCB', 100, 90), pos('KPLC', 500, 22)], targets });
    expect(plan.unassigned).toEqual([{ ticker: 'KPLC', valueKes: 11_000 }]);
    expect(plan.baseKes).toBe(69_000);
    expect(plan.warnings.join(' ')).toMatch(/KPLC is not in your targets/);
  });

  it('buys a targeted stock the member does not hold yet, using fresh cash and the default broker fee', () => {
    const plan = planRebalance({
      positions: [pos('SCOM', 1000, 30)],
      targets: [{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'EQTY', weightPct: 50 }],
      extraPrices: { EQTY: 100 },
      defaultFeePct: 1.2,
      defaultBrokerName: 'Main',
      cashKes: 30_000,
    });
    const buy = plan.trades.find((t) => t.ticker === 'EQTY')!;
    expect(plan.baseKes).toBe(60_000);
    expect(buy).toMatchObject({ action: 'BUY', shares: 300, brokerName: 'Main' });
    expect(buy.feeKes).toBe(360);
  });

  it('warns when fees are a large share of the portfolio, and when a fee is unknown', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 2000, 30, 4), pos('KCB', 100, 90, null, null)], targets });
    expect(plan.warnings.join(' ')).toMatch(/no broker fee on record/);
    expect(plan.warnings.join(' ')).toMatch(/cost about/);
  });

  it('asks for cash rather than inventing a trade when the targets cannot be reached with no cash', () => {
    const plan = planRebalance({ positions: [], targets });
    expect(plan.trades).toEqual([]);
    expect(plan.warnings.join(' ')).toMatch(/nothing to measure against/);
  });

  it('never recommends in terms of "sell it"; it only states trades to reach the member\'s own targets', () => {
    const plan = planRebalance({ positions: [pos('SCOM', 2000, 30), pos('KCB', 100, 90)], targets });
    expect(plan.warnings.every((w) => !/you should|we recommend/i.test(w))).toBe(true);
  });
});

import {
  AdviceBody,
  MAX_STALE_DAYS,
  MIN_SESSIONS,
  allNumbers,
  buildAdvicePrompt,
  buildPriceFacts,
  dataProblem,
  extractFigures,
  fallbackAdvice,
  figuresFromFacts,
  metricsFromFacts,
  relevantNews,
  trendClaimProblems,
  verifyAdvice,
} from './advice-grounding';

/** n consecutive daily closes ending on `end`, prices from `start` rising by `step`. */
function closes(n: number, end = '2026-11-05', start = 30, step = 0.1) {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => ({ date: new Date(endMs - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10), price: Math.round((start + i * step) * 100) / 100 }));
}

const advice = (over: Partial<AdviceBody> = {}): AdviceBody => ({
  situation: 'Safaricom keeps growing mobile money revenue.',
  recommendation: 'HOLD',
  recommendationRationale: 'Fits a dividend investor.',
  reasons: ['Steady dividend record'],
  risks: ['Regulatory risk'],
  outlook: 'Uncertain but stable.',
  ...over,
});

describe('buildPriceFacts', () => {
  it('computes the latest close, moves over 1/5/20/60 sessions and the 60-session range', () => {
    const f = buildPriceFacts(closes(70), '2026-11-05')!;
    expect(f.asOf).toBe('2026-11-05');
    expect(f.priceKes).toBeCloseTo(36.9, 6);
    expect(f.dayChangePct).toBeCloseTo((0.1 / 36.8) * 100, 4);
    expect(f.change20Pct).toBeCloseTo(((36.9 - 34.9) / 34.9) * 100, 4);
    expect(f.change60Pct).toBeCloseTo(((36.9 - 31.0) / 31.0) * 100, 4);
    expect(f.lo60).toBeCloseTo(31.0, 6);
    expect(f.hi60).toBeCloseTo(36.9, 6);
    expect(f.sessions).toBe(70);
    expect(f.daysOld).toBe(0);
  });

  it('leaves a move null when there is not enough history for it', () => {
    const f = buildPriceFacts(closes(10), '2026-11-05')!;
    expect(f.change20Pct).toBeNull();
    expect(f.change5Pct).not.toBeNull();
  });

  it('is null with no data and measures staleness in days', () => {
    expect(buildPriceFacts([], '2026-11-05')).toBeNull();
    expect(buildPriceFacts(undefined, '2026-11-05')).toBeNull();
    expect(buildPriceFacts(closes(30, '2026-10-27'), '2026-11-05')!.daysOld).toBe(9);
  });
});

describe('dataProblem', () => {
  it('accepts fresh data with enough history', () => {
    expect(dataProblem(buildPriceFacts(closes(MIN_SESSIONS), '2026-11-05'))).toBeNull();
  });
  it('rejects missing, stale and thin data with a reason the user can read', () => {
    expect(dataProblem(null)).toMatch(/no recorded prices/);
    expect(dataProblem(buildPriceFacts(closes(30, '2026-10-20'), '2026-11-05'))).toMatch(/too old/);
    expect(MAX_STALE_DAYS).toBe(7);
    expect(dataProblem(buildPriceFacts(closes(MIN_SESSIONS - 1), '2026-11-05'))).toMatch(/not enough for a trend/);
  });
});

describe('metricsFromFacts', () => {
  const f = buildPriceFacts(closes(70), '2026-11-05')!;
  it('lists price, moves, range, profile facts and the position - all from our data', () => {
    const m = metricsFromFacts(f, { dividend_yield: 5.2, risk_level: 'medium' }, { quantity: 100, avgCost: 30, costEstimated: true, gainPct: 23 });
    expect(m[0]).toBe('Latest close: KSh 36.90 (2026-11-05)');
    expect(m).toContain('Dividend yield (profile): 5.2%');
    expect(m).toContain('You hold: 100 shares');
    expect(m.some((x) => x.includes('estimated') && x.includes('+23.0%'))).toBe(true);
  });
  it('omits what it does not know', () => {
    const m = metricsFromFacts(buildPriceFacts(closes(25), '2026-11-05')!, {}, null);
    expect(m.some((x) => x.startsWith('60 sessions'))).toBe(false);
    expect(m.some((x) => x.startsWith('You hold'))).toBe(false);
  });
});

describe('extractFigures / allNumbers', () => {
  it('reads KSh and percentage figures regardless of formatting, ignoring plain numbers', () => {
    expect(extractFigures('Price KSh 1,234.50 and KES 34.00, up 12.5% or 8 percent; 7 countries in 2026')).toEqual(['1234.5', '34', '12.5', '8']);
  });
  it('collects every number a search result mentions', () => {
    expect([...allNumbers('Profit rose 12% to Sh 5.5 billion in 2025')].sort()).toEqual(['12', '2025', '5.5']);
  });
});

describe('verifyAdvice', () => {
  const f = buildPriceFacts(closes(70), '2026-11-05')!;
  const allowed = new Set([...figuresFromFacts(f, null, [5.2]), ...allNumbers('Net profit grew 12% and the dividend was Sh 1.20 per share')]);

  it('passes text with no figures, or only figures from our data or the news', () => {
    expect(verifyAdvice(advice(), allowed)).toEqual([]);
    expect(verifyAdvice(advice({ situation: 'Profit grew 12% and it closed at KSh 36.90, a dividend yield of 5.2%.' }), allowed)).toEqual([]);
    expect(verifyAdvice(advice({ situation: 'The dividend was KES 1.2 a share.' }), allowed)).toEqual([]);
  });

  it('rejects a figure that is in neither our data nor the news - the stale-price and made-up-number cases', () => {
    const p = verifyAdvice(advice({ situation: 'It trades at KSh 34.00 after a 7.4% slide.' }), allowed);
    expect(p).toHaveLength(2);
    expect(p[0]).toContain('"34"');
    expect(p[1]).toContain('"7.4"');
  });

  it('checks every field, including reasons and risks', () => {
    expect(verifyAdvice(advice({ reasons: ['Earnings up 99%'] }), allowed)[0]).toContain('reasons[0]');
    expect(verifyAdvice(advice({ risks: ['A KSh 500 loss'] }), allowed)[0]).toContain('risks[0]');
  });

  it('rejects overconfident wording', () => {
    expect(verifyAdvice(advice({ outlook: 'A guaranteed winner.' }), allowed)[0]).toContain('guaranteed');
    expect(verifyAdvice(advice({ outlook: 'It is certain to rise.' }), allowed).length).toBe(1);
  });
});

describe('figuresFromFacts', () => {
  it('treats 35.2, 35.20 and 35 as supported when the price is 35.2', () => {
    const f = { ...buildPriceFacts(closes(30), '2026-11-05')!, priceKes: 35.2 };
    const set = figuresFromFacts(f, null);
    expect(extractFigures('KSh 35.20 and KSh 35.2 and KSh 35').every((x) => set.has(x))).toBe(true);
  });
});

describe('fallbackAdvice', () => {
  it('is always HOLD, says why, and quotes only recorded data', () => {
    const f = buildPriceFacts(closes(70), '2026-11-05')!;
    const a = fallbackAdvice({ company_name: 'Safaricom PLC', sector: 'Telecommunications' }, f, { verdict: 'Good Match', reasons: ['Strong yield', 'Low risk', 'Stable', 'Extra'] }, 'Not enough data.');
    expect(a.recommendation).toBe('HOLD');
    expect(a.recommendationRationale).toContain('Not enough data.');
    expect(a.recommendationRationale).toContain('not giving a buy or avoid view');
    expect(a.situation).toContain('KSh 36.90');
    expect(a.reasons).toEqual(['Strong yield', 'Low risk', 'Stable']);
    expect(fallbackAdvice({ company_name: 'X' }, null, null, 'No data.').situation).toContain('no recent price data');
  });
});

describe('buildAdvicePrompt', () => {
  const base = { company: 'Safaricom PLC', ticker: 'SCOM', sector: 'Telecommunications', profileContext: 'A Moderate investor.', positionContext: 'POSITION: does not hold it yet.', metrics: ['Latest close: KSh 35.20 (2026-11-05)'] };
  it('puts our data first, tells the model to ignore other prices, and handles missing news', () => {
    const p = buildAdvicePrompt({ ...base, news: '[1] Q3 results', hasNews: true });
    expect(p).toContain('OUR DATA (authoritative');
    expect(p).toContain('- Latest close: KSh 35.20 (2026-11-05)');
    expect(p).toContain('ignore that price');
    expect(p).toContain('[1] Q3 results');
    const none = buildAdvicePrompt({ ...base, news: '', hasNews: false });
    expect(none).toContain('none was found');
    expect(none).not.toContain('search results; may be older');
  });
});

// SCOM on 5 Nov 2026: 35.20, 60-session range 33.00-38.65 -> 39% of the way up, down 1.8% over 20 sessions.
const scomFacts = () => ({ ...buildPriceFacts(closes(70), '2026-11-05')!, priceKes: 35.2, lo60: 33, hi60: 38.65, dayChangePct: 3.7, change5Pct: 5.9, change20Pct: -1.8, change60Pct: -0.6 });

describe('trendClaimProblems - the live SCOM misreading', () => {
  it('rejects "near the upper end of its range" when the price is in the lower half of it', () => {
    const p = trendClaimProblems('The stock sits near the upper end of its 60-session range.', scomFacts());
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('39%');
  });
  it('accepts the same words when they are true, and ignores unrelated uses of high/low/higher', () => {
    const top = { ...scomFacts(), priceKes: 38.2 };
    expect(trendClaimProblems('It is trading near the top of its range.', top)).toEqual([]);
    expect(trendClaimProblems('The price is near its 60-day high.', top)).toEqual([]);
    expect(trendClaimProblems('Dividends could move toward higher levels; margins are at a lower base.', scomFacts())).toEqual([]);
  });
  it('rejects "near the bottom" when the price is in the upper part of the range', () => {
    expect(trendClaimProblems('It sits close to the low of its range.', { ...scomFacts(), priceKes: 37 })).toHaveLength(1);
    expect(trendClaimProblems('It sits close to the low of its range.', { ...scomFacts(), priceKes: 33.1 })).toEqual([]);
  });
  it('rejects a momentum claim only when every window disagrees with it', () => {
    const allDown = { ...scomFacts(), change5Pct: -1, change20Pct: -2, change60Pct: -3 };
    expect(trendClaimProblems('There is strong upward momentum.', allDown)).toHaveLength(1);
    expect(trendClaimProblems('There is strong upward momentum.', scomFacts())).toEqual([]); // up 5.9% over 5 sessions
    const allUp = { ...scomFacts(), change5Pct: 1, change20Pct: 2, change60Pct: 3 };
    expect(trendClaimProblems('A clear downtrend is in place.', allUp)).toHaveLength(1);
  });
  it('is applied by verifyAdvice, per field, when facts are supplied', () => {
    const a = advice({ reasons: ['Current price near the upper bound of the 60-session range suggests near-term upside.'] });
    expect(verifyAdvice(a, new Set(), scomFacts())[0]).toContain('reasons[0]');
    expect(verifyAdvice(a, new Set())).toEqual([]); // facts not supplied -> only figure/wording checks
  });
});

describe('metricsFromFacts - position in range', () => {
  it('states where the price sits so the model has no need to guess', () => {
    expect(metricsFromFacts(scomFacts(), {}, null)).toContain('Position in that range: 39% of the way from the low to the high');
  });
});

describe('relevantNews - the live KCB mix-up', () => {
  const r = (title: string, content = '') => ({ title, content });
  const kcb = { company_name: 'KCB Group Plc', ticker: 'KCB' };

  it('drops results about the exchange itself that do not mention the company', () => {
    const results = [
      r('Nairobi Securities Exchange stock in focus after H1 profit surge', 'NSE Plc profit rose on a block trade.'),
      r('KCB Group posts record half-year profit', 'KCB Group said...'),
      r('NSE Share Prices Today & Listed Companies', 'Gainers and losers list'),
    ];
    expect(relevantNews(results, kcb).map((x) => x.title)).toEqual(['KCB Group posts record half-year profit']);
  });

  it('matches the ticker as a whole word, not inside another word', () => {
    expect(relevantNews([r('KCB shares rally')], kcb)).toHaveLength(1);
    expect(relevantNews([r('Bank of Kenya', 'unrelated KCBX text')], kcb)).toHaveLength(0);
  });

  it('matches a multi-word name as a phrase, and a ticker mention in the text', () => {
    const hafr = { company_name: 'Home Afrika Limited', ticker: 'HAFR' };
    expect(relevantNews([r('Home Afrika Share Price: KSh1.06')], hafr)).toHaveLength(1);
    expect(relevantNews([r('Market update', 'Gainers: Home Afrika, Uchumi')], hafr)).toHaveLength(1);
    expect(relevantNews([r('Market update', 'Gainers: HAFR, UCHM')], hafr)).toHaveLength(1);
    expect(relevantNews([r('Afrika news', 'a home for all')], hafr)).toHaveLength(0);
  });

  it('keeps single-name companies by their name, ignoring generic words like Plc and Group', () => {
    const scom = { company_name: 'Safaricom PLC', ticker: 'SCOM' };
    expect(relevantNews([r('Safaricom half-year results'), r('Telecom sector review', 'no names here')], scom)).toHaveLength(1);
  });
});

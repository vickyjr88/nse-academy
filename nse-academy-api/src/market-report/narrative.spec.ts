import { buildFacts } from './market-facts';
import { Narrative, URL_PLACEHOLDER, buildPrompt, fillUrl, parseNarrative, templateNarrative, verifyNarrative } from './narrative';

const facts = buildFacts({
  sessionYmd: '2026-11-04',
  label: 'Wednesday 4 November 2026',
  shortLabel: 'Wed 4 Nov',
  weekday: 3,
  rows: [
    { ticker: 'SCOM', name: 'Safaricom', price: 30, volume: '4000000', change: '1.50' },
    { ticker: 'KCB', name: 'KCB Group', price: 50, volume: '800000', change: '-2.00' },
    { ticker: 'KPC', name: 'Kenya Pipeline', price: 12.15, volume: '2000000', change: '-10.00' },
    { ticker: 'NCBA', name: 'NCBA Group', price: 91.75, volume: '100000', change: '4.26' },
  ],
  history: {},
  sectors: {},
});

const good = (): Narrative => templateNarrative(facts);

describe('templateNarrative', () => {
  it('produces a complete narrative that passes its own verifier (so the fallback can never be rejected)', () => {
    const n = good();
    expect(n.headline).toContain('Wed 4 Nov');
    expect(n.story.length).toBeGreaterThanOrEqual(2);
    expect(n.lessons.length).toBeGreaterThanOrEqual(2);
    expect(verifyNarrative(n, facts)).toEqual([]);
  });

  it('every X post fits in 280 characters once {URL} counts as 23', () => {
    const n = good();
    for (const t of [n.social.xPost, ...n.social.xThread]) {
      expect(t.split(URL_PLACEHOLDER).join('x'.repeat(23)).length).toBeLessThanOrEqual(280);
    }
    expect(n.social.xPost).toContain(URL_PLACEHOLDER);
  });

  it('round-trips through the parser (so the stored shape is the shape we validate)', () => {
    const { narrative, errors } = parseNarrative(JSON.stringify(good()));
    expect(errors).toEqual([]);
    expect(narrative).not.toBeNull();
  });
});

describe('verifyNarrative', () => {
  const withStory = (story: string[]): Narrative => ({ ...good(), story });

  it('accepts figures that are in the facts, including rounded and unit-scaled forms', () => {
    const n = withStory([
      'KPC fell 10% to KSh 12.15 on KSh 24.3 million of trading.', // 24,300,000 -> 24.3 million
      'NCBA rose 4.26%, or about 4.3%.',
    ]);
    const v = verifyNarrative(n, facts);
    expect(v.join('|')).not.toContain('24.3');
    expect(v.join('|')).not.toContain('4.26');
    expect(v.join('|')).not.toContain('4.3');
  });

  it('rejects an invented percentage', () => {
    const v = verifyNarrative(withStory(['SCOM surged 17.5% after the close.', 'x']), facts);
    expect(v).toContainEqual(expect.stringContaining('17.5'));
  });

  it('rejects an invented price and an invented amount', () => {
    const v = verifyNarrative(withStory(['KCB closed at KSh 77.30 with KSh 500 million traded.', 'x']), facts);
    expect(v.join('|')).toContain('77.30');
    expect(v.join('|')).toContain('500 million');
  });

  it('allows dates, years, small counts and "N-day" windows, which are not market figures', () => {
    const n = withStory(['On 4 November 2026 the 20-day average was the benchmark; 3 stocks stood out.', 'x']);
    expect(verifyNarrative(n, facts)).toEqual([]);
  });

  it('is type-aware: a number must match a fact of the same KIND, not just resemble some other number', () => {
    const share = facts.concentration!.sharePct; // a real percentage in these facts - but not a price
    expect(verifyNarrative(withStory([`SCOM closed at KSh ${share}.`, 'x']), facts).join('|')).toContain(String(share));
    expect(verifyNarrative(withStory(['SCOM rose 99.9%.', 'x']), facts).join('|')).toContain('99.9%'); // resembles a 100,000 share count, but no percentage
    expect(verifyNarrative(withStory([`SCOM was ${share}% of trading.`, 'x']), facts)).toEqual([]);
  });

  it('accepts a figure rounded to the precision it is written at, but not one that is merely close', () => {
    expect(verifyNarrative(withStory(['NCBA rose about 4%.', 'x']), facts)).toEqual([]); // 4.26 -> 4
    expect(verifyNarrative(withStory(['NCBA rose 4.3%.', 'x']), facts)).toEqual([]); // 4.26 -> 4.3
    expect(verifyNarrative(withStory(['NCBA rose 4.4%.', 'x']), facts).join('|')).toContain('4.4%'); // 4.26 does not round to 4.4
  });

  it('checks multiples against the volume-spike facts only', () => {
    expect(verifyNarrative(withStory(['It traded 7.5 times its usual value.', 'x']), facts).join('|')).toContain('7.5');
  });

  it('rejects "X% of the average" - the exact misreading the live AI produced for a day that was 76% ABOVE average', () => {
    const f = buildFacts({ ...{ sessionYmd: '2026-11-04', label: 'Wednesday 4 November 2026', shortLabel: 'Wed 4 Nov', weekday: 3 },
      rows: [{ ticker: 'SCOM', name: 'Safaricom', price: 30, volume: '4000000', change: '1.50' }],
      history: Object.fromEntries([['SCOM', Array.from({ length: 10 }, (_, i) => ({ ymd: `2026-10-${String(i + 1).padStart(2, '0')}`, value: 68_181_818, changePct: 0 }))]]),
      sectors: {} });
    expect(f.valueVsAvgPct).toBe(76);
    const v = verifyNarrative({ ...templateNarrative(f), summary: 'Traded value reached KSh 120 million, about 76% of the recent daily average.' }, f);
    expect(v.join('|')).toContain('misreads the comparison');
    expect(v.join('|')).toContain('76% above its recent average'); // the feedback tells the model the right wording
    // the correct phrasing is fine
    expect(verifyNarrative({ ...templateNarrative(f), summary: 'Traded value was KSh 120 million, 76% above its recent average.' }, f)).toEqual([]);
  });

  it('rejects a faller described as a riser, and a riser described as a faller', () => {
    // KCB fell 2% in these facts; NCBA rose 4.26%
    expect(verifyNarrative(withStory(['KCB rose 2% on the day.', 'x']), facts).join('|')).toMatch(/direction.*FALL as a rise/);
    expect(verifyNarrative(withStory(['NCBA fell 4.26% on the day.', 'x']), facts).join('|')).toMatch(/direction.*RISE as a fall/);
  });

  it('accepts correct directions, including sentences that legitimately mention both', () => {
    expect(verifyNarrative(withStory(['KCB fell 2% while NCBA rose 4.26%.', 'x']), facts)).toEqual([]);
    expect(verifyNarrative(withStory(['NCBA closed up 4.26% at KSh 91.75.', 'x']), facts)).toEqual([]);
    expect(verifyNarrative(withStory(['KPC dropped 10%, at the limit.', 'x']), facts)).toEqual([]);
  });

  it('rejects turning KSh turnover into a gain or loss - the live AI wrote "the biggest loss at KSh 93.7 million"', () => {
    for (const bad of [
      'Kenya Pipeline had the biggest loss at KSh 24.3 million.',
      'The largest gain by value was SCOM.',
      'SCOM made a KSh 120 million gain.',
      'KCB lost KSh 40 million of value.',
    ]) {
      expect(verifyNarrative(withStory([bad, 'x']), facts).join('|')).toMatch(/gain or loss|treats a KSh/);
    }
    // turnover described as turnover is fine
    expect(verifyNarrative(withStory(['SCOM led turnover at KSh 120 million, while KPC fell 10%.', 'x']), facts)).toEqual([]);
  });

  it('rejects guessing a cause - any mention of news or "due to / driven by"', () => {
    for (const bad of ['Such spikes often indicate heightened interest or news.', 'KPC fell due to profit-taking.', 'The move was driven by banks.']) {
      expect(verifyNarrative(withStory([bad, 'x']), facts).join('|')).toMatch(/cause wording/);
    }
  });

  it('rejects sentiment labels the numbers do not support', () => {
    for (const bad of ['The NSE closes flat on Wednesday.', 'A bearish session for banks.', 'SCOM plunged on the day.', 'Markets rallied.']) {
      expect(verifyNarrative(withStory([bad, 'x']), facts).join('|')).toMatch(/sentiment wording/);
    }
  });

  it('rejects advice-style and predictive wording', () => {
    for (const bad of ['You should buy SCOM today.', 'We recommend holding KCB.', 'SCOM will rally tomorrow.', 'A guaranteed gain.', 'Set a price target of the high.']) {
      expect(verifyNarrative(withStory([bad, 'x']), facts).length).toBeGreaterThan(0);
    }
  });

  it('scans social copy and lessons too, not only the story', () => {
    const n = good();
    n.social.whatsapp = '*SCOM* jumped 42% today ' + URL_PLACEHOLDER;
    n.lessons[0].body = 'KPC lost 55% of its value.';
    const v = verifyNarrative(n, facts).join('|');
    expect(v).toContain('42%');
    expect(v).toContain('55%');
  });
});

describe('parseNarrative', () => {
  it('extracts JSON from a response wrapped in markdown fences or chatter', () => {
    const raw = 'Sure! Here you go:\n```json\n' + JSON.stringify(good()) + '\n```\nHope that helps.';
    expect(parseNarrative(raw).narrative?.headline).toBe(good().headline);
  });

  it('reports every structural problem instead of silently accepting a bad shape', () => {
    const broken = { ...good(), story: ['only one'], social: { ...good().social, xPost: 'no placeholder here', hashtags: ['#a'] } };
    const { narrative, errors } = parseNarrative(JSON.stringify(broken));
    expect(narrative).toBeNull();
    expect(errors.join('|')).toMatch(/story needs/);
    expect(errors.join('|')).toMatch(/xPost must contain/);
    expect(errors.join('|')).toMatch(/hashtags/);
  });

  it('rejects an X post that is too long', () => {
    const n = good();
    n.social.xPost = 'a'.repeat(270) + ' ' + URL_PLACEHOLDER;
    expect(parseNarrative(JSON.stringify(n)).errors.join('|')).toMatch(/xPost is longer/);
  });

  it('handles non-JSON output', () => {
    expect(parseNarrative('I cannot do that.').narrative).toBeNull();
    expect(parseNarrative('{ broken json').narrative).toBeNull();
  });

  it('normalises hashtags that are missing the #', () => {
    const n = good();
    n.social.hashtags = ['NSE', '#Investing', 'Kenya'];
    expect(parseNarrative(JSON.stringify(n)).narrative?.social.hashtags).toEqual(['#NSE', '#Investing', '#Kenya']);
  });
});

describe('buildPrompt / fillUrl', () => {
  it('puts the rules and the facts in front of the model, and forbids advice and invented causes', () => {
    const { system, user } = buildPrompt(facts);
    expect(system).toMatch(/ONLY numbers that appear in FACTS/);
    expect(system).toMatch(/NO investment advice/);
    expect(system).toMatch(/Do NOT state or guess WHY/);
    expect(system).toMatch(/NEVER write "X% of the average"/);
    expect(system).toMatch(/VALUE TRADED/);
    expect(system).toMatch(/Do NOT label the market/);
    expect(user).toContain('"SCOM"');
    expect(user).toContain('{URL}');
  });

  it('fills the URL placeholder in the share copy only', () => {
    const n = fillUrl(good(), 'https://x.test/r/2026-11-04');
    expect(n.social.xPost).toContain('https://x.test/r/2026-11-04');
    expect(n.social.whatsapp).toContain('https://x.test/r/2026-11-04');
    expect(n.social.xPost).not.toContain(URL_PLACEHOLDER);
  });
});

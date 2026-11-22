import { parseStreamLine, ruleDiff, searchQueryFromRules, spendAllows, spendBuckets, streamCommentary } from './x-stream-logic';

describe('ruleDiff', () => {
  it('adds missing rules and deletes ones the config no longer wants', () => {
    const diff = ruleDiff(
      [{ tag: 'official', value: 'from:NSE_PLC' }, { tag: 'desk', value: 'from:kenyanwalstreet' }],
      [{ id: '1', tag: 'official', value: 'from:NSE_PLC' }, { id: '2', tag: 'keyword', value: 'NSE' }],
    );
    expect(diff.add).toEqual([{ tag: 'desk', value: 'from:kenyanwalstreet' }]);
    expect(diff.deleteIds).toEqual(['2']);
  });
});

describe('spendAllows', () => {
  it('stops at the daily count and at the monthly dollar cap', () => {
    expect(spendAllows({ todayPosts: 200, monthUsd: 1, dailyPostCap: 200, monthlyUsdCap: 15, unitUsd: 0.005 })).toBe(false);
    expect(spendAllows({ todayPosts: 1, monthUsd: 14.999, dailyPostCap: 200, monthlyUsdCap: 15, unitUsd: 0.005 })).toBe(false);
    expect(spendAllows({ todayPosts: 1, monthUsd: 1, dailyPostCap: 200, monthlyUsdCap: 15, unitUsd: 0.005 })).toBe(true);
  });

  it('buckets a Nairobi day and its month separately', () => {
    expect(spendBuckets('2026-11-05')).toEqual({ day: '2026-11-05', month: 'm:2026-11' });
  });
});

describe('parseStreamLine', () => {
  it('ignores keepalives and reads the tagged post', () => {
    expect(parseStreamLine('  ')).toBeNull();
    expect(parseStreamLine(JSON.stringify({ data: { id: '9', text: 'hello' }, matching_rules: [{ tag: 'official' }] }))).toEqual({
      id: '9',
      text: 'hello',
      tag: 'official',
    });
    expect(parseStreamLine(JSON.stringify({ errors: [{ message: 'rate' }] }))).toEqual({ error: 'rate' });
  });

  it('keeps a joined search query inside the 512 character limit', () => {
    expect(searchQueryFromRules([{ tag: 'official', value: 'from:NSE_PLC' }])).toBe('(from:NSE_PLC)');
    expect(searchQueryFromRules([])).toBeNull();
    expect(streamCommentary('official')).not.toMatch(/\d/);
  });
});

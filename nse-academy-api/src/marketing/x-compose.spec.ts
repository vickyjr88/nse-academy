import { tweetProblems, stripModelText, DEFAULT_X_POST_MODEL } from './x-compose';

describe('tweetProblems', () => {
  it('accepts a rewrite that only repeats numbers from the draft', () => {
    const draft = 'KCB is the biggest rise so far, +4.5% at KSh 40.';
    expect(tweetProblems('KCB leads so far, +4.5% at KSh 40. Educational only.', draft, 'market')).toEqual([]);
  });

  it('rejects an invented number, advice, and a cause', () => {
    const source = 'Official NSE post. Read the original.';
    expect(tweetProblems('Safaricom rose 12% because of news. You should buy.', source, 'market').length).toBeGreaterThan(0);
    expect(tweetProblems('The post mentions a 12% move.', 'results up 12%', 'stream')).toEqual([]);
    expect(tweetProblems('You should buy this.', 'results', 'stream')).toContain('advice');
  });
});

describe('stripModelText', () => {
  it('drops fences and wrapping quotes', () => {
    expect(stripModelText('```\n"Hello"\n```')).toBe('Hello');
  });

  it('names the free router as the default model', () => {
    expect(DEFAULT_X_POST_MODEL).toBe('openrouter/free');
  });
});

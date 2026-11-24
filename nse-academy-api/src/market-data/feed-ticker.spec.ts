import { resolveFeedTicker } from './feed-ticker';

describe('resolveFeedTicker', () => {
  it('keeps a ticker the feed supplied, trimmed and upper-cased', () => {
    expect(resolveFeedTicker(' scom ', 'Safaricom Ltd')).toBe('SCOM');
  });

  it('fills QuickMart in by name, whatever the suffix or case', () => {
    for (const name of ['QuickMart Plc', 'QUICKMART PLC', 'Quickmart Ltd', 'QuickMart PLc Ord']) {
      expect(resolveFeedTicker('', name)).toBe('QMRT');
    }
    expect(resolveFeedTicker(undefined, 'QuickMart Plc')).toBe('QMRT');
  });

  it('refuses an unknown company with no ticker, so a blank is never stored', () => {
    expect(resolveFeedTicker('', 'Some New Company Plc')).toBeNull();
    expect(resolveFeedTicker('  ', '')).toBeNull();
  });
});

import { accountHealth, historyWhere, successRate, summarizePosts } from './social-stats';

const now = new Date('2026-11-23T09:00:00Z'); // 12:00 in Nairobi
const at = (iso: string) => new Date(iso);
const row = (platform: string, status: string, iso: string) => ({ platform, status, publishedAt: at(iso) });

describe('summarizePosts', () => {
  const rows = [
    row('x', 'published', '2026-11-23T06:00:00Z'),
    row('x', 'published', '2026-11-22T06:00:00Z'),
    row('x', 'failed', '2026-11-22T07:00:00Z'),
    row('facebook', 'published', '2026-11-21T06:00:00Z'),
    row('threads', 'draft', '2026-11-21T07:00:00Z'),
    row('x', 'published', '2026-11-12T06:00:00Z'), // the period before a 7-day window
    row('x', 'failed', '2026-11-11T06:00:00Z'),
    row('x', 'published', '2026-10-01T06:00:00Z'), // older than both windows
    row('x', 'weird', '2026-11-22T06:00:00Z'), // unknown status is ignored
  ];
  const s = summarizePosts(rows, now, 7, ['x', 'facebook', 'instagram', 'threads', 'tiktok']);

  it('counts a day per bar, oldest first, with empty days kept', () => {
    expect(s.byDay).toHaveLength(7);
    expect(s.byDay[0].day).toBe('2026-11-17');
    expect(s.byDay[6]).toEqual({ day: '2026-11-23', published: 1, failed: 0, draft: 0 });
    expect(s.byDay[5]).toEqual({ day: '2026-11-22', published: 1, failed: 1, draft: 0 });
    expect(s.byDay[0]).toEqual({ day: '2026-11-17', published: 0, failed: 0, draft: 0 });
  });

  it('totals the window and the period before it', () => {
    expect(s.totals).toEqual({ published: 3, failed: 1, draft: 1, successRate: 75 });
    expect(s.previous).toEqual({ published: 1, failed: 1 });
  });

  it('lists every platform, including ones that never posted', () => {
    expect(s.byPlatform.map((p) => p.platform)).toEqual(['x', 'facebook', 'instagram', 'threads', 'tiktok']);
    const ig = s.byPlatform.find((p) => p.platform === 'instagram')!;
    expect(ig).toMatchObject({ published: 0, failed: 0, successRate: null, lastPublishedAt: null });
    const x = s.byPlatform.find((p) => p.platform === 'x')!;
    expect(x).toMatchObject({ published: 2, failed: 1, successRate: 67 });
    expect(x.lastPublishedAt).toBe('2026-11-23T06:00:00.000Z');
  });

  it('puts a post made just after Nairobi midnight on the Nairobi day', () => {
    const late = summarizePosts([row('x', 'published', '2026-11-22T21:30:00Z')], now, 3);
    expect(late.byDay.find((d) => d.day === '2026-11-23')!.published).toBe(1);
  });

  it('adds a platform it was not told about instead of losing its posts', () => {
    const s2 = summarizePosts([row('linkedin', 'published', '2026-11-23T06:00:00Z')], now, 3);
    expect(s2.byPlatform.map((p) => p.platform)).toEqual(['linkedin']);
  });
});

describe('successRate', () => {
  it('is null with nothing attempted and rounds otherwise', () => {
    expect(successRate(0, 0)).toBeNull();
    expect(successRate(2, 1)).toBe(67);
    expect(successRate(0, 3)).toBe(0);
  });
});

describe('accountHealth', () => {
  const base = { platform: 'facebook', isActive: true, expiresAt: null, lastTestedAt: at('2026-11-20T00:00:00Z') };

  it('reports a paused account first', () => {
    expect(accountHealth({ ...base, isActive: false, expiresAt: at('2026-01-01T00:00:00Z') }, now).state).toBe('paused');
  });

  it('warns a week ahead for a token that does not renew, and flags it once it ends', () => {
    expect(accountHealth({ ...base, expiresAt: at('2026-11-28T09:00:00Z') }, now)).toEqual({ state: 'expiring', daysLeft: 5 });
    expect(accountHealth({ ...base, expiresAt: at('2026-12-30T00:00:00Z') }, now).state).toBe('ok');
    expect(accountHealth({ ...base, expiresAt: at('2026-11-22T09:00:00Z') }, now).state).toBe('expired');
  });

  it('does not warn about a Threads or refreshable TikTok token ending soon, only about a failed renewal', () => {
    const soon = at('2026-11-24T09:00:00Z');
    expect(accountHealth({ ...base, platform: 'threads', expiresAt: soon }, now).state).toBe('ok');
    expect(accountHealth({ ...base, platform: 'tiktok', hasRefreshToken: true, expiresAt: at('2026-11-23T08:00:00Z') }, now).state).toBe('ok');
    expect(accountHealth({ ...base, platform: 'tiktok', hasRefreshToken: true, expiresAt: at('2026-11-18T09:00:00Z') }, now).state).toBe('expired');
    expect(accountHealth({ ...base, platform: 'tiktok', hasRefreshToken: false, expiresAt: at('2026-11-23T08:00:00Z') }, now).state).toBe('expired');
  });

  it('asks for a test when the account was never tested', () => {
    expect(accountHealth({ ...base, lastTestedAt: null }, now).state).toBe('untested');
  });
});

describe('historyWhere', () => {
  it('is empty with no filters', () => {
    expect(historyWhere({})).toEqual({});
  });

  it('maps each filter, ignoring an unknown status and a bad date', () => {
    expect(historyWhere({ platform: 'x', status: 'failed', credentialId: 'c1', before: '2026-11-20T00:00:00Z' })).toEqual({
      platform: 'x',
      status: 'failed',
      credentialId: 'c1',
      publishedAt: { lt: new Date('2026-11-20T00:00:00Z') },
    });
    expect(historyWhere({ status: 'bogus', before: 'not a date' })).toEqual({});
  });

  it('searches the text and the error, trimmed and bounded', () => {
    const w = historyWhere({ q: '  rate limit  ' }) as { OR: { content?: { contains: string }; error?: { contains: string } }[] };
    expect(w.OR[0].content!.contains).toBe('rate limit');
    expect(w.OR[1].error!.contains).toBe('rate limit');
    expect(historyWhere({ q: '   ' })).toEqual({});
    expect((historyWhere({ q: 'a'.repeat(500) }) as typeof w).OR[0].content!.contains).toHaveLength(100);
  });
});

import { PlatformTarget } from './x-automation.config';
import { TIKTOK_TITLE_LIMIT, addHashtags, platformText, tiktokFields } from './platform-copy';

const target = (overrides: Partial<PlatformTarget> = {}): PlatformTarget => ({
  platform: 'instagram',
  enabled: true,
  credentialId: null,
  suffix: '',
  hashtags: '',
  tiktokPrivacy: 'SELF_ONLY',
  ...overrides,
});

const report = 'NSE closed higher today. The full report is at https://nseacademy.co.ke/market-report/2026-11-20';

describe('addHashtags', () => {
  it('adds only tags the post does not already carry, ignoring case', () => {
    expect(addHashtags('NSE is up #nse', '#NSE #Investing')).toBe('NSE is up #nse\n\n#Investing');
  });

  it('ignores input that is not a tag and strips extra hashes', () => {
    expect(addHashtags('Quiet day', '##NSE, investing, tag!')).toBe('Quiet day\n\n#NSE #investing');
  });

  it('leaves the post untouched when every tag is already there', () => {
    expect(addHashtags('Quiet day #NSE', '#nse')).toBe('Quiet day #NSE');
  });
});

describe('platformText', () => {
  it('adds the suffix and hashtags to the X sentence', () => {
    const text = platformText('instagram', 'NSE closed higher.', target({ suffix: 'Educational only.', hashtags: '#NSE #Investing' }));
    expect(text).toBe('NSE closed higher.\n\nEducational only.\n\n#NSE #Investing');
  });

  it('does not repeat a suffix the X sentence already contains', () => {
    const text = platformText('facebook', 'NSE closed higher. Educational only.', target({ platform: 'facebook', suffix: 'educational only.' }));
    expect(text).toBe('NSE closed higher. Educational only.');
  });

  it('keeps the trailing report link when it has to shorten the sentence', () => {
    const long = `${'A'.repeat(300)} ${report}`;
    const text = platformText('x', long, target({ platform: 'x', hashtags: '#NSE' }));
    expect(text.length).toBeLessThanOrEqual(280);
    expect(text.endsWith('https://nseacademy.co.ke/market-report/2026-11-20')).toBe(true);
  });

  it('drops the suffix and hashtags before it shortens the story', () => {
    const text = platformText('threads', 'B'.repeat(490), target({ platform: 'threads', suffix: 'Follow for more.', hashtags: '#NSE' }));
    expect(text).toHaveLength(490);
  });

  it('returns an empty string for an empty source', () => {
    expect(platformText('facebook', '   ', target({ platform: 'facebook', hashtags: '#NSE' }))).toBe('');
  });
});

describe('tiktokFields', () => {
  it('takes the first non-empty line as a short title', () => {
    const fields = tiktokFields(`\n\nNSE closed higher today\n\nThe full report is at https://nseacademy.co.ke/market-report`, target({ platform: 'tiktok' }));
    expect(fields.title).toBe('NSE closed higher today');
    expect(fields.title.length).toBeLessThanOrEqual(TIKTOK_TITLE_LIMIT);
    expect(fields.description).toContain('The full report');
  });

  it('trims a long title to the TikTok limit', () => {
    const fields = tiktokFields('C'.repeat(200), target({ platform: 'tiktok' }));
    expect(fields.title).toHaveLength(TIKTOK_TITLE_LIMIT);
  });
});

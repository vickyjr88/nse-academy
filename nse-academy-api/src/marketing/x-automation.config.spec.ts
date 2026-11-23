import { DEFAULT_CONFIG, SOCIAL_PLATFORMS, STARTER_CONFIG, normalizeConfig, normalizePlatforms } from './x-automation.config';

describe('normalizeConfig', () => {
  it('ships off, in draft, with the hourly slots and the two tight stream rules', () => {
    const config = normalizeConfig(undefined);
    expect(config.enabled).toBe(false);
    expect(config.mode).toBe('draft');
    expect(config.aiCompose).toBe(false);
    expect(config.slots.map((s) => s.id)).toEqual(['open', 'mover-am', 'breadth', 'spotlight', 'active', 'mover-pm', 'close-approach', 'close', 'evening-wrap']);
    expect(config.streamRules.map((r) => r.tag)).toEqual(['official', 'desk']);
    expect(config.streamEnabled).toBe(false);
  });

  it('seeds a live weekday poster and leaves the paid stream off', () => {
    expect(STARTER_CONFIG.enabled).toBe(true);
    expect(STARTER_CONFIG.mode).toBe('live');
    expect(STARTER_CONFIG.streamEnabled).toBe(false);
    expect(STARTER_CONFIG.aiCompose).toBe(false);
    expect(STARTER_CONFIG.days).toEqual([1, 2, 3, 4, 5]);
    expect(STARTER_CONFIG.slots.filter((s) => s.enabled)).toHaveLength(9);
  });

  it('drops an unknown template and clamps a live config', () => {
    const config = normalizeConfig({
      enabled: true,
      mode: 'live',
      aiCompose: true,
      moverThresholdPct: 50,
      slots: [
        { id: 'Bad id!', enabled: true, hour: 11, template: 'not-a-template' },
        { id: 'noon', enabled: true, hour: 12, template: 'spotlight' },
      ],
      streamRules: [{ tag: 'Keyword', value: 'NSE' }],
    });
    expect(config.mode).toBe('live');
    expect(config.moverThresholdPct).toBe(20);
    expect(config.slots).toEqual([{ id: 'noon', enabled: true, hour: 12, template: 'spotlight' }]);
    expect(config.streamRules).toEqual([{ tag: 'keyword', value: 'NSE' }]);
    expect(config.lessons).toEqual(DEFAULT_CONFIG.lessons);
  });
});

describe('normalizePlatforms', () => {
  it('keeps an older X-only config posting to X and leaves the rest off', () => {
    const platforms = normalizePlatforms(undefined, 'cred-x');
    expect(platforms.map((target) => target.platform)).toEqual([...SOCIAL_PLATFORMS]);
    expect(platforms.find((target) => target.platform === 'x')).toMatchObject({ enabled: true, credentialId: 'cred-x' });
    expect(platforms.filter((target) => target.platform !== 'x').every((target) => target.enabled === false)).toBe(true);
  });

  it('keeps each platform account, copy and privacy level in a stable order', () => {
    const platforms = normalizePlatforms(
      [
        { platform: 'threads', enabled: true, credentialId: 'cred-threads', suffix: ' What do you think? ', hashtags: ' #NSE ', tiktokPrivacy: 'PUBLIC_TO_EVERYONE' },
        { platform: 'x', enabled: false, credentialId: 'cred-x' },
        { platform: 'not-a-platform', enabled: true },
      ],
      null,
    );
    expect(platforms.map((target) => target.platform)).toEqual([...SOCIAL_PLATFORMS]);
    expect(platforms.find((target) => target.platform === 'threads')).toMatchObject({
      enabled: true,
      credentialId: 'cred-threads',
      suffix: 'What do you think?',
      hashtags: '#NSE',
      tiktokPrivacy: 'PUBLIC_TO_EVERYONE',
    });
    expect(platforms.find((target) => target.platform === 'x')).toMatchObject({ enabled: false, credentialId: 'cred-x' });
  });

  it('falls back to SELF_ONLY for an unknown TikTok privacy level', () => {
    const [tiktok] = normalizePlatforms([{ platform: 'tiktok', enabled: true, tiktokPrivacy: 'EVERYONE' }], null).filter(
      (target) => target.platform === 'tiktok',
    );
    expect(tiktok.tiktokPrivacy).toBe('SELF_ONLY');
  });

  it('mirrors the X target into the legacy credentialId', () => {
    const config = normalizeConfig({ credentialId: 'old-x', platforms: [{ platform: 'x', enabled: true, credentialId: 'new-x' }] });
    expect(config.credentialId).toBe('new-x');
  });
});

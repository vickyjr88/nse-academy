import { PlatformTarget } from './x-automation.config';
import { SocialPostService } from './social-post.service';

const target = (overrides: Partial<PlatformTarget> = {}): PlatformTarget => ({
  platform: 'instagram',
  enabled: true,
  credentialId: null,
  suffix: 'Educational only.',
  hashtags: '#NSE',
  tiktokPrivacy: 'SELF_ONLY',
  ...overrides,
});

function setup() {
  const row = {
    id: 'cred-1',
    platform: 'instagram',
    accountName: 'NSE Academy',
    externalId: '17841400000000000',
    apiKey: 'k',
    apiSecret: 's',
    accessToken: 't',
    accessTokenSecret: '',
    refreshToken: '',
    bearerToken: '',
    expiresAt: null,
    isActive: true,
  };
  const prisma = {
    socialMediaCredential: { findUnique: jest.fn().mockResolvedValue(row), findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    socialMediaPost: {
      create: jest.fn().mockResolvedValue({ id: 'post-1' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
    },
  };
  const encryption = { decrypt: (value: string) => value } as any;
  const xService = { postToX: jest.fn(), saveDraft: jest.fn(), resendPost: jest.fn(), testCredentials: jest.fn(), deletePost: jest.fn() } as any;
  const meta = {
    publishFacebook: jest.fn(),
    publishInstagram: jest.fn().mockResolvedValue({ postId: 'ig-1', url: 'https://instagram.com/p/abc' }),
    publishThreads: jest.fn(),
    test: jest.fn().mockResolvedValue({ success: true, message: 'ok' }),
    refreshThreadsIfNeeded: jest.fn((credential) => credential),
  } as any;
  const tiktok = { publishPhoto: jest.fn(), test: jest.fn() } as any;
  const service = new SocialPostService(prisma as any, encryption, xService, meta, tiktok);
  return { service, prisma, meta, xService, row };
}

describe('SocialPostService', () => {
  it('skips a platform that needs an image when there is none', async () => {
    const { service, meta } = setup();
    const delivery = await service.publishTarget(target(), 'NSE closed higher.', [], 'cred-1');
    expect(delivery).toEqual({ platform: 'instagram', status: 'skipped', reason: 'no images' });
    expect(meta.publishInstagram).not.toHaveBeenCalled();
  });

  it('publishes the tailored text and records the public URL', async () => {
    const { service, prisma, meta } = setup();
    const delivery = await service.publishTarget(target(), 'NSE closed higher.', ['https://example.com/card/1'], 'cred-1');
    expect(meta.publishInstagram).toHaveBeenCalledWith(
      expect.objectContaining({ accountName: 'NSE Academy' }),
      'NSE closed higher.\n\nEducational only.\n\n#NSE',
      ['https://example.com/card/1'],
    );
    expect(delivery).toMatchObject({ platform: 'instagram', status: 'posted', postId: 'ig-1', url: 'https://instagram.com/p/abc' });
    expect(prisma.socialMediaPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ platform: 'instagram', url: 'https://instagram.com/p/abc', status: 'published' }) }),
    );
  });

  it('publishes a non-X draft in place without creating a second history row', async () => {
    const { service, prisma, meta } = setup();
    prisma.socialMediaPost.findUnique.mockResolvedValue({
      id: 'draft-1',
      credentialId: 'cred-1',
      platform: 'instagram',
      reportType: 'manual',
      reportId: null,
      content: 'Draft text',
      mediaUrls: ['https://example.com/card/1'],
      status: 'draft',
    });
    const result = await service.resendPost('draft-1');
    expect(result).toEqual({ postId: 'ig-1', url: 'https://instagram.com/p/abc' });
    expect(meta.publishInstagram).toHaveBeenCalled();
    expect(prisma.socialMediaPost.create).not.toHaveBeenCalled();
    expect(prisma.socialMediaPost.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'draft-1' }, data: expect.objectContaining({ status: 'published', externalPostId: 'ig-1' }) }),
    );
  });

  describe('retrying a failed post', () => {
    const failed = {
      id: 'failed-1',
      credentialId: 'cred-1',
      platform: 'instagram',
      reportType: 'daily',
      reportId: '2026-11-20',
      content: 'Wrap text',
      mediaUrls: ['https://example.com/card/1'],
      status: 'failed',
      error: 'token expired',
    };

    it('publishes the stored text again and replaces the failed entry', async () => {
      const { service, prisma, meta } = setup();
      prisma.socialMediaPost.findUnique.mockResolvedValue(failed);
      const result = await service.resendPost('failed-1');
      expect(result).toEqual({ postId: 'ig-1', url: 'https://instagram.com/p/abc' });
      expect(meta.publishInstagram).toHaveBeenCalledWith(expect.anything(), 'Wrap text', ['https://example.com/card/1']);
      expect(prisma.socialMediaPost.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'published', reportId: '2026-11-20' }) }));
      expect(prisma.socialMediaPost.delete).toHaveBeenCalledWith({ where: { id: 'failed-1' } });
    });

    it('swaps the old failure for the new one when it fails again, so retries do not pile up', async () => {
      const { service, prisma, meta } = setup();
      prisma.socialMediaPost.findUnique.mockResolvedValue(failed);
      meta.publishInstagram.mockRejectedValue(new Error('still expired'));
      await expect(service.resendPost('failed-1')).rejects.toThrow('still expired');
      expect(prisma.socialMediaPost.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', error: 'still expired' }) }));
      expect(prisma.socialMediaPost.delete).toHaveBeenCalledWith({ where: { id: 'failed-1' } });
    });

    it('keeps the old entry when the account is paused, because nothing was attempted', async () => {
      const { service, prisma, meta, row } = setup();
      prisma.socialMediaPost.findUnique.mockResolvedValue(failed);
      (row as any).isActive = false;
      await expect(service.resendPost('failed-1')).rejects.toThrow('not active');
      expect(meta.publishInstagram).not.toHaveBeenCalled();
      expect(prisma.socialMediaPost.delete).not.toHaveBeenCalled();
    });

    it('retries an X post through the X path as well', async () => {
      const { service, prisma, xService } = setup();
      prisma.socialMediaPost.findUnique.mockResolvedValue({ ...failed, platform: 'x', mediaUrls: [] });
      prisma.socialMediaCredential.findUnique.mockResolvedValue({ id: 'cred-1', platform: 'x', accountName: 'NSE', apiKey: 'k', apiSecret: 's', accessToken: 't', accessTokenSecret: 'ts', isActive: true });
      xService.postToX.mockResolvedValue({ postId: 'tw-1', url: 'https://x.com/i/status/tw-1' });
      const result = await service.resendPost('failed-1');
      expect(result).toEqual({ postId: 'tw-1', url: 'https://x.com/i/status/tw-1' });
      expect(xService.postToX).toHaveBeenCalledWith('cred-1', 'Wrap text', [], '2026-11-20', { reportType: 'daily' });
      expect(xService.resendPost).not.toHaveBeenCalled();
      expect(prisma.socialMediaPost.delete).toHaveBeenCalledWith({ where: { id: 'failed-1' } });
    });
  });

  it('posts manual text as typed, without the configured suffix or hashtags', async () => {
    const { service, meta } = setup();
    await service.postNow('instagram', 'cred-1', 'A quick note', ['https://example.com/card/1']);
    expect(meta.publishInstagram).toHaveBeenCalledWith(expect.anything(), 'A quick note', ['https://example.com/card/1']);
  });

  it('tests an account on its own platform', async () => {
    const { service, meta } = setup();
    await expect(service.testCredentials('cred-1')).resolves.toEqual({ success: true, message: 'ok' });
    expect(meta.test).toHaveBeenCalled();
  });
});

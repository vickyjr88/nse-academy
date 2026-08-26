import { HttpException } from '@nestjs/common';
import { EbookService } from './ebook.service';
import { MAX_GUEST_DOWNLOADS, TRADING_GUIDE_PRODUCT_ID } from './ebook-access';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        email: 'jane@example.com',
      }),
      findFirst: jest.fn(),
    },
    ebookPurchase: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

function makeService(prisma: ReturnType<typeof mockPrisma>) {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PAYSTACK_SECRET_KEY') return 'sk_test';
      if (key === 'DEXTER_API_KEY') return 'dexter';
      if (key === 'WEB_URL') return 'https://example.com';
      return undefined;
    }),
  };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const paystack = {
    initializeTransaction: jest.fn(),
    verifyTransaction: jest.fn(),
  };
  return new EbookService(prisma as never, config as never, brevo as never, paystack as never);
}

describe('EbookService.getStatus', () => {
  it('returns [] subscriber access for free / inactive users - never null', async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma);
    const status = await service.getStatus('u1');
    expect(status.subscriberAccessProducts).toEqual([]);
    expect(status.subscriptionActive).toBe(false);
    expect(status.subscriptionTier).toBe('free');
  });

  it('returns null (all ebooks) for active premium', async () => {
    const prisma = mockPrisma();
    prisma.subscription.findUnique.mockResolvedValue({
      tier: 'premium',
      status: 'active',
    });
    const service = makeService(prisma);
    const status = await service.getStatus('u1');
    expect(status.subscriberAccessProducts).toBeNull();
    expect(status.subscriptionActive).toBe(true);
  });

  it('returns the trading guide id for active intermediary', async () => {
    const prisma = mockPrisma();
    prisma.subscription.findUnique.mockResolvedValue({
      tier: 'intermediary',
      status: 'active',
    });
    const service = makeService(prisma);
    const status = await service.getStatus('u1');
    expect(status.subscriberAccessProducts).toEqual([TRADING_GUIDE_PRODUCT_ID]);
  });
});

describe('EbookService.download', () => {
  it('returns 403 PURCHASE_REQUIRED with checkout path when unpaid', async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma);
    expect.assertions(3);
    try {
      await service.download('u1', 'product-xyz');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const body = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.code).toBe('PURCHASE_REQUIRED');
      expect(body.checkoutPath).toBe('/ebooks/buy/product-xyz');
    }
  });
});

describe('guest download limit', () => {
  const purchase = {
    id: 'p1',
    productId: TRADING_GUIDE_PRODUCT_ID,
    email: 'guest@example.com',
    guestToken: 'tok',
    downloadCount: 0,
    userId: null,
  };

  function stubDexter() {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        download_url: 'https://files/ebook.pdf',
        file_name: 'ebook.pdf',
      }),
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows the first download and reports one remaining', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({ ...purchase });
    stubDexter();
    const service = makeService(prisma);

    const result = await service.downloadByGuestToken('tok');

    expect(result.downloadCount).toBe(1);
    expect(result.remainingDownloads).toBe(MAX_GUEST_DOWNLOADS - 1);
    expect(result.download_url).toBe('https://files/ebook.pdf');
  });

  it('allows the second download and reports none remaining', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({
      ...purchase,
      downloadCount: MAX_GUEST_DOWNLOADS - 1,
    });
    stubDexter();
    const service = makeService(prisma);

    const result = await service.downloadByGuestToken('tok');

    expect(result.downloadCount).toBe(MAX_GUEST_DOWNLOADS);
    expect(result.remainingDownloads).toBe(0);
  });

  it('rejects the third download with DOWNLOAD_LIMIT_REACHED', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({
      ...purchase,
      downloadCount: MAX_GUEST_DOWNLOADS,
    });
    const service = makeService(prisma);

    expect.assertions(4);
    try {
      await service.downloadByGuestToken('tok');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const body = (err as HttpException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.code).toBe('DOWNLOAD_LIMIT_REACHED');
      expect(body.remainingDownloads).toBe(0);
      // The file must never be fetched once the limit is spent.
      expect(prisma.ebookPurchase.updateMany).not.toHaveBeenCalled();
    }
  });

  it('rejects when a concurrent request already claimed the last slot', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({
      ...purchase,
      downloadCount: MAX_GUEST_DOWNLOADS - 1,
    });
    // The guarded updateMany matches nothing: another request got there first.
    prisma.ebookPurchase.updateMany.mockResolvedValue({ count: 0 });
    const service = makeService(prisma);

    await expect(service.downloadByGuestToken('tok')).rejects.toMatchObject({
      response: { code: 'DOWNLOAD_LIMIT_REACHED' },
    });
  });

  it('refunds the download slot when the file fetch fails', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({ ...purchase });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    }) as unknown as typeof fetch;
    const service = makeService(prisma);

    await expect(service.downloadByGuestToken('tok')).rejects.toThrow();
    expect(prisma.ebookPurchase.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { downloadCount: { decrement: 1 } },
    });
  });

  it('reports link state without consuming a download', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({
      ...purchase,
      downloadCount: 1,
    });
    const service = makeService(prisma);

    const info = await service.getGuestAccessInfo('tok');

    expect(info.limitReached).toBe(false);
    expect(info.downloadCount).toBe(1);
    expect(info.remainingDownloads).toBe(MAX_GUEST_DOWNLOADS - 1);
    expect(prisma.ebookPurchase.updateMany).not.toHaveBeenCalled();
    expect(prisma.ebookPurchase.update).not.toHaveBeenCalled();
  });

  it('flags limitReached once the allowance is spent', async () => {
    const prisma = mockPrisma();
    prisma.ebookPurchase.findUnique.mockResolvedValue({
      ...purchase,
      downloadCount: MAX_GUEST_DOWNLOADS,
    });
    const service = makeService(prisma);

    const info = await service.getGuestAccessInfo('tok');

    expect(info.limitReached).toBe(true);
    expect(info.remainingDownloads).toBe(0);
  });
});

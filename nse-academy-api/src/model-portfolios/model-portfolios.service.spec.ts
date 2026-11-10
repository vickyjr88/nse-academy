import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ModelPortfoliosService } from './model-portfolios.service';

const day = (i: number) => new Date(Date.parse('2026-09-01T00:00:00Z') + i * 86_400_000).toISOString().slice(0, 10);
const closes = (tickers: string[], from = 0) => tickers.flatMap((t, k) => Array.from({ length: 70 - from }, (_, i) => ({ ticker: t, d: day(i + from), price: 10 + k * 5 + i * 0.05 })));

const input = { slug: 'steady', name: 'Steady', summary: 'Liquid names.', description: 'For cautious investors.', riskProfile: 'conservative', inceptionDate: '2026-09-01', reviewedBy: 'Jane Kamau, CFA, CMA licence 123', holdings: [{ ticker: 'scom', weightPct: 60 }, { ticker: 'KCB', weightPct: 40 }] };

function make(opts: { rows?: any[]; priced?: string[]; existing?: any } = {}) {
  const priced = opts.priced ?? ['SCOM', 'KCB'];
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(closes(priced)),
    modelPortfolio: {
      findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: 'm1', status: 'draft', publishedAt: null, ...data, holdings: data.holdings.create.map((h: any, i: number) => ({ id: `h${i}`, modelId: 'm1', ...h })) })),
      update: jest.fn(async ({ data }: any) => ({ id: 'm1', ...opts.existing, ...data, holdings: opts.existing?.holdings ?? [] })),
      delete: jest.fn().mockResolvedValue({}),
    },
    modelPortfolioHolding: { deleteMany: jest.fn().mockReturnValue('del') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const allocation = {
    overview: jest.fn().mockResolvedValue({ rows: [{ ticker: 'SCOM', weightPct: 70 }, { ticker: 'KPLC', weightPct: 30 }] }),
    setTargets: jest.fn(async (_u: string, t: any[]) => t),
  };
  return { svc: new ModelPortfoliosService(prisma as never, allocation as never), prisma, allocation };
}

const stored = (over: any = {}) => ({ id: 'm1', slug: 'steady', name: 'Steady', summary: 's', description: 'd', riskProfile: 'conservative', status: 'draft', reviewedBy: 'Jane', inceptionDate: '2026-09-01', publishedAt: null, holdings: [{ id: 'h1', modelId: 'm1', ticker: 'SCOM', weightPct: 60, rationale: null }, { id: 'h2', modelId: 'm1', ticker: 'KCB', weightPct: 40, rationale: null }], ...over });

describe('ModelPortfoliosService', () => {
  it('creates a draft, normalising codes, with performance worked out from the closes', async () => {
    const { svc, prisma } = make();
    const m = await svc.create(input as never);
    expect(prisma.modelPortfolio.create.mock.calls[0][0].data.holdings.create.map((h: any) => h.ticker)).toEqual(['SCOM', 'KCB']);
    expect(m.status).toBe('draft');
    expect(m.performance?.sincePct).toBeGreaterThan(0);
  });

  it('refuses an invalid model and a stock with no price history, and reports a taken address', async () => {
    await expect(make().svc.create({ ...input, holdings: [{ ticker: 'SCOM', weightPct: 90 }, { ticker: 'KCB', weightPct: 5 }] } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(make({ priced: ['SCOM'] }).svc.create(input as never)).rejects.toThrow(/No recent price history for KCB/);
    const { svc, prisma } = make();
    prisma.modelPortfolio.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    await expect(svc.create(input as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('will not publish without a named reviewer, or without complete price history', async () => {
    await expect(make({ existing: stored({ reviewedBy: ' ' }) }).svc.publish('m1')).rejects.toThrow(/who reviewed/);
    await expect(make({ existing: stored({ inceptionDate: '2026-06-01' }) }).svc.publish('m1')).rejects.toThrow(/price history from the inception date/);
    const { svc, prisma } = make({ existing: stored() });
    const p = await svc.publish('m1');
    expect(prisma.modelPortfolio.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'published' }) }));
    expect(p.status).toBe('published');
  });

  it('sends a published model back to draft when its weights change, but not for a wording change', async () => {
    const pub = stored({ status: 'published', publishedAt: new Date() });
    const a = make({ existing: pub });
    a.prisma.modelPortfolio.findUnique.mockResolvedValue(pub);
    await a.svc.update('m1', { ...input, holdings: [{ ticker: 'SCOM', weightPct: 50 }, { ticker: 'KCB', weightPct: 50 }] } as never);
    expect(a.prisma.modelPortfolio.update.mock.calls[0][0].data).toMatchObject({ status: 'draft', publishedAt: null });

    const b = make({ existing: pub });
    b.prisma.modelPortfolio.findUnique.mockResolvedValue(pub);
    await b.svc.update('m1', { ...input, summary: 'A better summary.' } as never);
    expect(b.prisma.modelPortfolio.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('shows only published models publicly', async () => {
    const { svc } = make({ existing: stored() });
    await expect(svc.getPublished('steady')).rejects.toThrow('not found');
  });

  it('compares a member\'s holdings with a model and can copy its weights into their targets', async () => {
    const { svc, allocation } = make({ existing: stored({ status: 'published' }) });
    const c = await svc.compare('u1', 'steady');
    expect(c).toMatchObject({ slug: 'steady', hasHoldings: true, overlapPct: 60 });
    expect(c.notInModel).toEqual([{ ticker: 'KPLC', weightPct: 30 }]);
    const r = await svc.useAsTargets('u1', 'steady');
    expect(allocation.setTargets).toHaveBeenCalledWith('u1', [{ ticker: 'SCOM', weightPct: 60 }, { ticker: 'KCB', weightPct: 40 }]);
    expect(r.targets).toHaveLength(2);
  });
});

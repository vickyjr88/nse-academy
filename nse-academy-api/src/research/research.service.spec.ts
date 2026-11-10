import { BadRequestException, ConflictException } from '@nestjs/common';
import { ResearchService } from './research.service';
import { REVIEWER_PLACEHOLDER } from './research-facts';

const day = (i: number) => new Date(Date.now() + 3 * 3_600_000 - (99 - i) * 86_400_000).toISOString().slice(0, 10);
const barRows = (ticker: string, n = 100, drift = 0.3) => Array.from({ length: n }, (_, i) => ({ ticker, d: day(i + (100 - n)), price: 100 + i * drift, volume: '200000' }));

function make(opts: { rows?: any[]; note?: any } = {}) {
  const prisma = {
    $queryRaw: jest.fn(async (...args: any[]) => {
      const sql = String(args[0]?.join ? args[0].join('?') : args[0]);
      if (sql.includes('distinct on (ticker) ticker, name')) return [{ ticker: 'AAA', name: 'Alpha Ltd' }, { ticker: 'BBB', name: 'Beta Ltd' }];
      return opts.rows ?? [...barRows('AAA', 100, 0.4), ...barRows('BBB', 100, -0.05)];
    }),
    researchNote: {
      findUnique: jest.fn().mockResolvedValue(opts.note ?? null),
      create: jest.fn(async ({ data }: any) => ({ id: 'n1', status: 'draft', reviewedBy: null, publishedAt: null, updatedAt: new Date(), ...data })),
      update: jest.fn(async ({ data, where }: any) => ({ id: where.id, kind: 'BRIEF', slug: 's', title: 't', summary: 's', body: 'b', tickers: [], period: null, facts: {}, status: 'draft', reviewedBy: null, publishedAt: null, updatedAt: new Date(), ...opts.note, ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    },
  };
  const facts = { sectorMap: jest.fn().mockResolvedValue({ AAA: 'Banking Sector' }) };
  return { svc: new ResearchService(prisma as never, facts as never), prisma };
}

const note = (over: any = {}) => ({ id: 'n1', kind: 'BRIEF', slug: 'brief-aaa', title: 'T', summary: 'S', body: 'A real analysis.', tickers: ['AAA'], period: null, facts: {}, status: 'draft', reviewedBy: 'Jane, CFA', publishedAt: null, updatedAt: new Date(), ...over });

describe('ResearchService', () => {
  it('drafts a company brief from the stored prices, as a draft with a reviewer placeholder', async () => {
    const { svc, prisma } = make();
    const n = await svc.generateBrief('aaa');
    expect(n.slug).toBe('brief-aaa');
    expect(n.status).toBe('draft');
    expect(n.body).toContain('Alpha Ltd (AAA) is listed in the Banking Sector sector');
    expect(n.body).toContain(REVIEWER_PLACEHOLDER);
    expect(prisma.researchNote.create).toHaveBeenCalled();
  });

  it('will not draft a brief for a stock without enough history', async () => {
    const { svc } = make({ rows: barRows('AAA', 30) });
    await expect(svc.generateBrief('AAA')).rejects.toThrow(/enough recent price history/);
  });

  it('never overwrites a published note, but regenerates a draft and clears its reviewer', async () => {
    await expect(make({ note: note({ status: 'published' }) }).svc.generateBrief('AAA')).rejects.toBeInstanceOf(ConflictException);
    const { svc, prisma } = make({ note: note() });
    await svc.generateBrief('AAA');
    expect(prisma.researchNote.update.mock.calls[0][0].data).toMatchObject({ reviewedBy: null });
  });

  it('drafts a focus list when stocks qualify, and says so plainly when none do', async () => {
    const { svc } = make({ rows: [...barRows('AAA', 100, 0.4), ...barRows('BBB', 100, 0.35)] });
    const n = await svc.generateFocusList('2026-12');
    expect(n.slug).toBe('focus-list-2026-12');
    expect(n.tickers.length).toBeGreaterThan(0);
    await expect(make({ rows: [] }).svc.generateFocusList('2026-12')).rejects.toThrow(/No liquid stock met any/);
    await expect(make().svc.generateFocusList('12-2026')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publishes only with a named reviewer and the placeholder replaced', async () => {
    await expect(make({ note: note({ reviewedBy: null }) }).svc.publish('n1')).rejects.toThrow(/who reviewed/);
    await expect(make({ note: note({ body: `Intro. ${REVIEWER_PLACEHOLDER}: write here.]` }) }).svc.publish('n1')).rejects.toThrow(/placeholder/);
    const { svc, prisma } = make({ note: note() });
    expect((await svc.publish('n1')).status).toBe('published');
    expect(prisma.researchNote.update.mock.calls[0][0].data.status).toBe('published');
  });

  it('sends a published note back to draft if its reviewer is removed or the placeholder comes back', async () => {
    const pub = note({ status: 'published', publishedAt: new Date() });
    const a = make({ note: pub });
    await a.svc.update('n1', { reviewedBy: '' });
    expect(a.prisma.researchNote.update.mock.calls[0][0].data).toMatchObject({ status: 'draft', publishedAt: null });
    const b = make({ note: pub });
    await b.svc.update('n1', { body: 'Reworded analysis, still reviewed.' });
    expect(b.prisma.researchNote.update.mock.calls[0][0].data.status).toBeUndefined();
  });

  it('shows only published notes publicly', async () => {
    await expect(make({ note: note() }).svc.getPublished('brief-aaa')).rejects.toThrow('not found');
    expect((await make({ note: note({ status: 'published' }) }).svc.briefFor('AAA')).slug).toBe('brief-aaa');
  });
});

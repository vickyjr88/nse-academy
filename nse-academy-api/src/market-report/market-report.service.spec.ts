import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketReportService, resolveCardUrls } from './market-report.service';
import { buildFacts } from './market-facts';
import { URL_PLACEHOLDER, templateNarrative } from './narrative';

const facts = buildFacts({
  sessionYmd: '2026-11-04',
  label: 'Wednesday 4 November 2026',
  shortLabel: 'Wed 4 Nov',
  weekday: 3,
  rows: [
    { ticker: 'SCOM', name: 'Safaricom', price: 30, volume: '4000000', change: '1.50' },
    { ticker: 'KCB', name: 'KCB Group', price: 50, volume: '800000', change: '-2.00' },
  ],
  history: {},
  sectors: {},
});
const nar = templateNarrative(facts);

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    sessionDate: '2026-11-04',
    status: 'published',
    facts,
    story: { headline: nar.headline, summary: nar.summary, story: nar.story, lessons: nar.lessons },
    social: nar.social,
    aiGenerated: false,
    aiModel: null,
    createdAt: new Date(),
    publishedAt: new Date('2026-11-05T05:10:00Z'),
    updatedAt: new Date(),
    ...over,
  };
}

function make(existing: unknown = null) {
  const prisma = {
    marketReport: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn().mockResolvedValue(row()),
      findMany: jest.fn().mockResolvedValue([row()]),
      upsert: jest.fn(async ({ create }) => row({ ...create })),
      update: jest.fn(async ({ data }) => row(data)),
    },
  };
  const factsSvc = { build: jest.fn().mockResolvedValue(facts), latestSessionYmd: jest.fn().mockResolvedValue('2026-11-04') };
  const narratives = {
    write: jest.fn().mockResolvedValue({ narrative: nar, aiGenerated: true, model: 'free/m:free' }),
    validate: jest.fn((c: unknown) => (c === 'bad' ? { narrative: null, problems: ['nope'] } : { narrative: nar, problems: [] })),
  };
  const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn((k: string) => (k === 'WEB_URL' ? 'https://site.test' : undefined)) };
  const service = new MarketReportService(prisma as never, factsSvc as never, narratives as never, notifier as never, config as never);
  return { service, prisma, factsSvc, narratives, notifier };
}
const flush = () => new Promise((r) => setImmediate(r));

describe('MarketReportService.generate', () => {
  it('builds facts, writes the narrative, and publishes a new report', async () => {
    const { service, prisma, factsSvc } = make();
    const r = await service.generate({ date: '2026-11-04' });
    expect(factsSvc.build).toHaveBeenCalledWith('2026-11-04');
    expect(prisma.marketReport.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.marketReport.upsert.mock.calls[0][0].create.cardImageUrls[0]).toBe(
      'https://site.test/market-report/2026-11-04/card/1',
    );
    expect(r.created).toBe(true);
    expect(r.report.status).toBe('published');
  });

  it('is idempotent: an existing report is returned untouched, with no AI call and no rewrite', async () => {
    const { service, prisma, narratives } = make(row());
    const r = await service.generate({ date: '2026-11-04' });
    expect(r.created).toBe(false);
    expect(narratives.write).not.toHaveBeenCalled();
    expect(prisma.marketReport.upsert).not.toHaveBeenCalled();
  });

  it('force rebuilds an existing report', async () => {
    const { service, narratives } = make(row());
    const r = await service.generate({ date: '2026-11-04', force: true });
    expect(narratives.write).toHaveBeenCalledTimes(1);
    expect(r.created).toBe(false);
  });

  it('uses an editor-supplied narrative instead of calling the AI, once it verifies, crediting the author', async () => {
    const { service, narratives, prisma } = make();
    await service.generate({ date: '2026-11-04', narrative: nar, narrativeAuthor: 'claude-sonnet-5-5' });
    expect(narratives.write).not.toHaveBeenCalled();
    const created = prisma.marketReport.upsert.mock.calls[0][0].create;
    expect(created).toMatchObject({ aiGenerated: true, aiModel: 'claude-sonnet-5-5' });
  });

  it('refuses to publish a supplied narrative that fails verification, and says why', async () => {
    const { service, prisma } = make();
    await expect(service.generate({ date: '2026-11-04', narrative: 'bad' })).rejects.toThrow(BadRequestException);
    expect(prisma.marketReport.upsert).not.toHaveBeenCalled();
  });

  it('defaults to the latest session when no date is given, and rejects a malformed date', async () => {
    const { service, factsSvc } = make();
    await service.generate({});
    expect(factsSvc.build).toHaveBeenCalledWith('2026-11-04');
    await expect(service.generate({ date: '04/11/2026' })).rejects.toThrow(BadRequestException);
  });

  it('emails the admin the share pack only when asked', async () => {
    const quiet = make();
    await quiet.service.generate({ date: '2026-11-04' });
    await flush();
    expect(quiet.notifier.notify).not.toHaveBeenCalled();

    const loud = make();
    await loud.service.generate({ date: '2026-11-04', notify: true });
    await flush();
    expect(loud.notifier.notify).toHaveBeenCalledTimes(1);
    const mail = loud.notifier.notify.mock.calls[0][0];
    expect(mail.subject).toContain('Wed 4 Nov');
    expect(mail.rawHtml).toContain('WhatsApp channel');
    expect(mail.rawHtml).toContain('https://site.test/market-report/2026-11-04/card/1');
  });
});

describe('resolveCardUrls', () => {
  const site = 'https://nseacademy.co.ke';
  const fresh = [
    `${site}/market-report/2026-11-04/card/1`,
    `${site}/market-report/2026-11-04/card/2`,
  ];

  it('rebuilds an empty cache', () => {
    const urls = resolveCardUrls([], site, '2026-11-04');
    expect(urls).toHaveLength(5);
    expect(urls[0]).toBe(`${site}/market-report/2026-11-04/card/1`);
  });

  it('rebuilds URLs that point at the old host', () => {
    const urls = resolveCardUrls(
      ['https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-04/card/1'],
      site,
      '2026-11-04',
    );
    expect(urls.every((url) => url.startsWith(site))).toBe(true);
  });

  it('rebuilds a malformed URL rather than trusting it', () => {
    const urls = resolveCardUrls(['not a url'], site, '2026-11-04');
    expect(urls[0]).toBe(`${site}/market-report/2026-11-04/card/1`);
  });

  it('keeps a cache that already points at the public site', () => {
    expect(resolveCardUrls(fresh, site, '2026-11-04')).toBe(fresh);
  });
});

describe('MarketReportService public reads', () => {
  it('serves a published report with the real page URL filled into the share copy', async () => {
    const { service } = make(row());
    const r = await service.getPublic('2026-11-04');
    expect(r.url).toBe('https://site.test/market-report/2026-11-04');
    expect(r.share.xPost).toContain('https://site.test/market-report/2026-11-04');
    expect(r.share.xPost).not.toContain(URL_PLACEHOLDER);
  });

  it('does not expose the reel script publicly (that is for the admin email)', async () => {
    const { service } = make(row());
    const r = await service.getPublic('2026-11-04');
    expect(JSON.stringify(r)).not.toContain('"reel"');
    expect(Object.keys(r.share).sort()).toEqual(['caption', 'hashtags', 'whatsapp', 'xPost', 'xThread']);
  });

  it('treats an unpublished or missing report as not found', async () => {
    await expect(make(row({ status: 'unpublished' })).service.getPublic('2026-11-04')).rejects.toThrow(NotFoundException);
    await expect(make(null).service.getPublic('2026-11-04')).rejects.toThrow(NotFoundException);
  });

  it('lists only published reports, newest first, as compact summaries', async () => {
    const { service, prisma } = make();
    const list = await service.listPublic(10);
    expect(prisma.marketReport.findMany.mock.calls[0][0]).toMatchObject({ where: { status: 'published' }, orderBy: { sessionDate: 'desc' }, take: 10 });
    expect(list[0]).toMatchObject({ sessionYmd: '2026-11-04', topGainer: { ticker: 'SCOM' }, topLoser: { ticker: 'KCB' } });
    expect(list[0]).not.toHaveProperty('story');
  });

  it('caps the list size so one request cannot pull the whole table', async () => {
    const { service, prisma } = make();
    await service.listPublic(100000);
    expect(prisma.marketReport.findMany.mock.calls[0][0].take).toBe(100);
  });
});

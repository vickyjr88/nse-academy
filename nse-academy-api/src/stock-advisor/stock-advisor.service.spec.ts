import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { StockAdvisorService } from './stock-advisor.service';

const NOW = new Date('2026-11-05T13:30:00Z');

const STOCK = {
  id: 1,
  ticker: 'SCOM',
  company_name: 'Safaricom PLC',
  sector: 'Telecommunications',
  description: 'Leading Kenyan telco',
  dividend_yield: 5.2,
  risk_level: 'medium',
  investor_types: ['dividend', 'moderate'],
};

function stubStrapiFetch() {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [STOCK] }) }) as unknown as typeof fetch;
}

/** 30 daily closes for `ticker` ending on `end`, rising 0.1 a day to 35.2 on the last. */
function rows(end = '2026-11-05', n = 30, ticker = 'SCOM') {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => ({ ticker, d: new Date(endMs - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10), price: Math.round((35.2 - (n - 1 - i) * 0.1) * 100) / 100 }));
}

const goodAdvice = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    situation: 'Safaricom keeps growing mobile money revenue, and profit grew 12%.',
    keyMetrics: ['Latest Price: KSh 999 (made up by the model)'],
    recommendation: 'BUY',
    recommendationRationale: 'Fits a dividend investor.',
    reasons: ['Dividend yield of 5.2%'],
    risks: ['Regulatory risk'],
    outlook: 'Positive but uncertain.',
    sources: ['Made up outlet'],
    ...over,
  });

function makeService(
  o: {
    completions?: (string | Error)[];
    news?: unknown[];
    rows?: unknown[];
    holdings?: unknown[];
    hasKey?: boolean;
    profile?: unknown;
  } = {},
) {
  const prisma = {
    investorProfile: {
      findUnique: jest.fn().mockResolvedValue(o.profile === undefined ? { type: 'dividend', riskScore: 40, horizonYears: 5, capitalRange: '100k-500k' } : o.profile),
    },
    holding: { findMany: jest.fn().mockResolvedValue(o.holdings ?? []) },
    $queryRaw: jest.fn().mockResolvedValue(o.rows ?? rows()),
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => (key === 'CMS_URL' ? 'http://cms.test' : key === 'CMS_API_TOKEN' ? 'test-token' : fallback)),
  };
  const queue = [...(o.completions ?? [goodAdvice()])];
  const openRouter = {
    hasCredentials: jest.fn().mockReturnValue(o.hasKey ?? true),
    chatCompletionDetailed: jest.fn(async () => {
      const next = queue.length > 1 ? queue.shift()! : queue[0];
      if (next instanceof Error) throw next;
      return { content: next, model: 'test/model' };
    }),
  };
  const tavily = {
    search: jest.fn().mockResolvedValue(
      o.news ?? [{ title: 'Safaricom FY results', url: 'https://www.businessdailyafrica.com/a', content: 'Net profit grew 12% on mobile money growth. Dividend of Sh 1.20 per share.' }],
    ),
  };
  const service = new StockAdvisorService(prisma as never, config as never, openRouter as never, tavily as never);
  return { service, prisma, openRouter, tavily };
}

const promptOf = (openRouter: ReturnType<typeof makeService>['openRouter'], call = 0): string =>
  (openRouter.chatCompletionDetailed.mock.calls as any[][])[call][0].messages[0].content;

describe('StockAdvisorService.getAiAdvice', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    stubStrapiFetch();
  });
  afterEach(() => jest.useRealTimers());

  it('puts our own latest close in the prompt as authoritative, alongside the search results', async () => {
    const { service, openRouter, tavily } = makeService();
    await service.getAiAdvice('u1', 'SCOM');
    expect(tavily.search).toHaveBeenCalledWith(expect.objectContaining({ topic: 'finance', timeRange: 'month' }));
    const prompt = promptOf(openRouter);
    expect(prompt).toContain('OUR DATA (authoritative');
    expect(prompt).toContain('Latest close: KSh 35.20 (2026-11-05)');
    expect(prompt).toContain('Safaricom FY results');
    expect(prompt).toContain('Net profit grew 12%');
  });

  it('builds the key metrics and the sources itself - the model\'s own versions are ignored', async () => {
    const { service } = makeService();
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(r.aiGenerated).toBe(true);
    expect(r.model).toBe('test/model');
    expect(r.recommendation).toBe('BUY');
    expect(r.keyMetrics[0]).toBe('Latest close: KSh 35.20 (2026-11-05)');
    expect(r.keyMetrics.join('|')).not.toContain('999');
    expect(r.sources).toEqual(['Safaricom FY results (businessdailyafrica.com)']);
    expect(r.dataAsOf).toBe('2026-11-05');
    expect(r.disclaimer).toContain('Not financial advice');
  });

  it('rejects an invented figure, tells the model exactly what was wrong, and accepts the corrected answer', async () => {
    const { service, openRouter } = makeService({ completions: [goodAdvice({ situation: 'It trades at KSh 34.00 after a 7.4% slide.' }), goodAdvice()] });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(r.aiGenerated).toBe(true);
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(2);
    const retry = (openRouter.chatCompletionDetailed.mock.calls as any[][])[1][0].messages;
    expect(retry[retry.length - 1].content).toContain('"34"');
  });

  it('gives a plain HOLD - never an unverified BUY - when the model keeps producing figures it cannot support', async () => {
    const bad = goodAdvice({ situation: 'It trades at KSh 34.00 after a 7.4% slide.' });
    const { service, openRouter } = makeService({ completions: [bad, bad] });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(2);
    expect(r.aiGenerated).toBe(false);
    expect(r.recommendation).toBe('HOLD');
    expect(r.recommendationRationale).toContain('could not be verified');
    expect(r.keyMetrics[0]).toContain('KSh 35.20');
    expect(r.situation).not.toContain('34.00');
  });

  it('does not call the AI at all when there are no recorded prices for the stock', async () => {
    const { service, openRouter } = makeService({ rows: [] });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(openRouter.chatCompletionDetailed).not.toHaveBeenCalled();
    expect(r).toMatchObject({ aiGenerated: false, recommendation: 'HOLD', keyMetrics: [], dataAsOf: null });
    expect(r.note).toMatch(/no recorded prices/);
  });

  it('does not ask the AI to opine on a stale price', async () => {
    const { service, openRouter } = makeService({ rows: rows('2026-10-20') });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(openRouter.chatCompletionDetailed).not.toHaveBeenCalled();
    expect(r.recommendation).toBe('HOLD');
    expect(r.note).toMatch(/too old/);
  });

  it('says plainly when no news was found and still answers from price data', async () => {
    const { service, openRouter } = makeService({ news: [], completions: [goodAdvice({ situation: 'The price has drifted up steadily.' })] });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(promptOf(openRouter)).toContain('none was found');
    expect(r.aiGenerated).toBe(true);
    expect(r.note).toMatch(/No recent news/);
    expect(r.sources).toEqual([]);
  });

  it('tells the model about the user\'s position and shows it in the metrics', async () => {
    const { service, openRouter } = makeService({ holdings: [{ quantity: 100, avgCost: 30, costSource: 'IMPORT_PRICE' }] });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(promptOf(openRouter)).toContain('already holds 100 shares, up 17.3% on cost (cost is an estimate)');
    expect(r.keyMetrics).toContain('You hold: 100 shares');
  });

  it('spends one search per company per 12 hours, however many people ask', async () => {
    const { service, tavily } = makeService();
    await service.getAiAdvice('u1', 'SCOM');
    await service.getAiAdvice('u2', 'SCOM');
    expect(tavily.search).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date(NOW.getTime() + 13 * 3_600_000));
    await service.getAiAdvice('u3', 'SCOM'); // a new day's data would be needed for a real run; here the rows are unchanged
    expect(tavily.search).toHaveBeenCalledTimes(2);
  });

  it('does not hammer the search when it returns nothing - an empty answer is retried only after a few minutes', async () => {
    const { service, tavily } = makeService({ news: [] });
    await service.getAiAdvice('u1', 'SCOM');
    await service.getAiAdvice('u2', 'SCOM');
    expect(tavily.search).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date(NOW.getTime() + 20 * 60_000));
    await service.getAiAdvice('u3', 'SCOM');
    expect(tavily.search).toHaveBeenCalledTimes(2);
  });

  it('serves the same user\'s repeat request for the same stock from cache, without another model call', async () => {
    const { service, openRouter } = makeService();
    await service.getAiAdvice('u1', 'SCOM');
    const again = await service.getAiAdvice('u1', 'SCOM');
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(1);
    expect(again.cached).toBe(true);
  });

  it('does not cache a fallback, so the next request tries again', async () => {
    const bad = goodAdvice({ situation: 'It trades at KSh 34.00.' });
    const { service, openRouter } = makeService({ completions: [bad, bad, goodAdvice()] });
    expect((await service.getAiAdvice('u1', 'SCOM')).aiGenerated).toBe(false);
    expect((await service.getAiAdvice('u1', 'SCOM')).aiGenerated).toBe(true);
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(3);
  });

  it('recovers JSON that is one closing brace short', async () => {
    const { service } = makeService({ completions: [goodAdvice().slice(0, -1)] });
    expect((await service.getAiAdvice('u1', 'SCOM')).aiGenerated).toBe(true);
  });

  it('treats unparseable output as a failed attempt, not a crash', async () => {
    const { service, openRouter } = makeService({ completions: ['not json at all', goodAdvice()] });
    expect((await service.getAiAdvice('u1', 'SCOM')).aiGenerated).toBe(true);
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(2);
  });

  it('turns a failed AI request into a retryable error', async () => {
    const { service } = makeService({ completions: [new Error('upstream 500')] });
    await expect(service.getAiAdvice('u1', 'SCOM')).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when OpenRouter has no credentials configured', async () => {
    const { service } = makeService({ hasKey: false });
    await expect(service.getAiAdvice('u1', 'SCOM')).rejects.toThrow(InternalServerErrorException);
  });

  it('throws NotFoundException for an unknown ticker', async () => {
    const { service } = makeService();
    await expect(service.getAiAdvice('u1', 'NOPE')).rejects.toThrow(NotFoundException);
  });

  it('works for a user with no investor profile', async () => {
    const { service, openRouter } = makeService({ profile: null });
    const r = await service.getAiAdvice('u1', 'SCOM');
    expect(r.aiGenerated).toBe(true);
    expect(promptOf(openRouter)).toContain('No investor profile yet');
  });
});

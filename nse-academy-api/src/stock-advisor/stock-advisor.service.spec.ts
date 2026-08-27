import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { StockAdvisorService } from './stock-advisor.service';

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
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: [STOCK] }),
  }) as unknown as typeof fetch;
}

function makeService(overrides: { openRouter?: Record<string, unknown>; tavily?: Record<string, unknown> } = {}) {
  const prisma = {
    investorProfile: {
      findUnique: jest.fn().mockResolvedValue({
        type: 'dividend',
        riskScore: 40,
        horizonYears: 5,
        capitalRange: '100k-500k',
      }),
    },
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'CMS_URL') return 'http://cms.test';
      if (key === 'CMS_API_TOKEN') return 'test-token';
      return fallback;
    }),
  };
  const openRouter = {
    hasCredentials: jest.fn().mockReturnValue(true),
    chatCompletion: jest.fn().mockResolvedValue(
      JSON.stringify({
        situation: 'Safaricom is performing well.',
        keyMetrics: ['Latest Price: KSh 18.50'],
        recommendation: 'BUY',
        recommendationRationale: 'Fits a dividend investor.',
        reasons: ['Strong dividend yield'],
        risks: ['Regulatory risk'],
        outlook: 'Positive outlook.',
        sources: ['Reuters'],
      }),
    ),
    ...overrides.openRouter,
  };
  const tavily = {
    search: jest.fn().mockResolvedValue([
      { title: 'Safaricom Q3 results', url: 'https://example.com/1', content: 'Earnings beat expectations.' },
    ]),
    ...overrides.tavily,
  };

  const service = new StockAdvisorService(prisma as never, config as never, openRouter as never, tavily as never);
  return { service, prisma, openRouter, tavily };
}

describe('StockAdvisorService.getAiAdvice', () => {
  beforeEach(() => {
    stubStrapiFetch();
  });

  it('grounds the prompt with Tavily search results before calling OpenRouter', async () => {
    const { service, tavily, openRouter } = makeService();

    await service.getAiAdvice('u1', 'SCOM');

    expect(tavily.search).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'finance', timeRange: 'month' }),
    );
    const prompt = (openRouter.chatCompletion as jest.Mock).mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Safaricom Q3 results');
    expect(prompt).toContain('Earnings beat expectations.');
  });

  it('returns the parsed recommendation from the OpenRouter completion', async () => {
    const { service } = makeService();

    const result = await service.getAiAdvice('u1', 'SCOM');

    expect(result).toMatchObject({
      ticker: 'SCOM',
      company_name: 'Safaricom PLC',
      recommendation: 'BUY',
      situation: 'Safaricom is performing well.',
    });
    expect(result.disclaimer).toContain('Not financial advice');
  });

  it('still returns a usable response when Tavily has no results (degrades gracefully)', async () => {
    const { service } = makeService({ tavily: { search: jest.fn().mockResolvedValue([]) } });

    const result = await service.getAiAdvice('u1', 'SCOM');

    expect(result.recommendation).toBe('BUY');
  });

  it('throws when OpenRouter has no credentials configured', async () => {
    const { service } = makeService({ openRouter: { hasCredentials: jest.fn().mockReturnValue(false) } });

    await expect(service.getAiAdvice('u1', 'SCOM')).rejects.toThrow(InternalServerErrorException);
  });

  it('throws NotFoundException for an unknown ticker', async () => {
    const { service } = makeService();

    await expect(service.getAiAdvice('u1', 'NOPE')).rejects.toThrow(NotFoundException);
  });

  it('falls back to a safe default shape when the completion is not valid JSON', async () => {
    const { service } = makeService({
      openRouter: { chatCompletion: jest.fn().mockResolvedValue('not json at all') },
    });

    const result = await service.getAiAdvice('u1', 'SCOM');

    expect(result.recommendation).toBe('HOLD');
    expect(result.reasons).toEqual(['Limited current data available']);
  });
});

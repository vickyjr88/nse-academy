import { TavilyService } from './tavily.service';

function makeService(apiKey = 'test-tavily-key') {
  const config = { get: jest.fn().mockReturnValue(apiKey) };
  return new TavilyService(config as never);
}

describe('TavilyService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hasCredentials reflects whether TAVILY_API_KEY is set', () => {
    expect(makeService().hasCredentials()).toBe(true);
    expect(makeService('').hasCredentials()).toBe(false);
  });

  it('posts the documented Tavily search request shape', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ title: 'A', url: 'https://a.test', content: 'content A' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService();
    const results = await service.search({ query: 'Safaricom NSE', topic: 'finance', timeRange: 'month' });

    expect(results).toEqual([{ title: 'A', url: 'https://a.test', content: 'content A' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-tavily-key' }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ query: 'Safaricom NSE', topic: 'finance', time_range: 'month' });
  });

  it('returns [] without calling fetch when no API key is configured', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const results = await makeService('').search({ query: 'anything' });

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('degrades to [] instead of throwing when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const results = await makeService().search({ query: 'anything' });

    expect(results).toEqual([]);
  });

  it('degrades to [] instead of throwing on a non-2xx response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const results = await makeService().search({ query: 'anything' });

    expect(results).toEqual([]);
  });
});

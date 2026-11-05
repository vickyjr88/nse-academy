import { InternalServerErrorException } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';

function makeService(configOverrides: Record<string, unknown> = {}) {
  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'OPENROUTER_API_KEY') return configOverrides.apiKey ?? 'test-key';
      if (key === 'OPENROUTER_MODEL') return configOverrides.model ?? fallback;
      return fallback;
    }),
  };
  return new OpenRouterService(config as never);
}

describe('OpenRouterService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hasCredentials reflects whether OPENROUTER_API_KEY is set', () => {
    expect(makeService().hasCredentials()).toBe(true);
    expect(makeService({ apiKey: '' }).hasCredentials()).toBe(false);
  });

  it('posts an OpenAI-compatible chat-completions request to OpenRouter', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Hello back' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService();
    const result = await service.chatCompletion({ messages: [{ role: 'user', content: 'Hello' }] });

    expect(result).toBe('Hello back');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(body.model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
  });

  it('uses the configured OPENROUTER_MODEL instead of the hardcoded default', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService({ model: 'anthropic/claude-3.5-haiku' });
    await service.chatCompletion({ messages: [{ role: 'user', content: 'Hi' }] });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe('anthropic/claude-3.5-haiku');
  });

  it('throws InternalServerErrorException without ever calling fetch when no API key is configured', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService({ apiKey: '' });
    await expect(
      service.chatCompletion({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow(InternalServerErrorException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws InternalServerErrorException when OpenRouter returns an error body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: 'Insufficient credits' } }),
    }) as unknown as typeof fetch;

    const service = makeService();
    await expect(
      service.chatCompletion({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws InternalServerErrorException when the response has no completion content', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    }) as unknown as typeof fetch;

    const service = makeService();
    await expect(
      service.chatCompletion({ messages: [{ role: 'user', content: 'Hi' }] }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('sends a models array (primary first) when fallback models are configured, and reports which model answered', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ model: 'fallback/model-b:free', choices: [{ message: { content: 'ok' } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const config = {
      get: jest.fn((k: string, d?: unknown) => ({ OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'primary/model-a:free', OPENROUTER_FALLBACK_MODELS: ' fallback/model-b:free , fallback/model-c:free ' } as Record<string, unknown>)[k] ?? d),
    };
    const result = await new OpenRouterService(config as never).chatCompletionDetailed({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toEqual({ content: 'ok', model: 'fallback/model-b:free' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.models).toEqual(['primary/model-a:free', 'fallback/model-b:free', 'fallback/model-c:free']);
    expect(body.model).toBeUndefined();
  });

  it('passes an abort signal so a hung request cannot block a report forever', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    await makeService().chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeDefined();
  });

  it('never sends more than 3 models - OpenRouter rejects longer chains - keeping the primary and the first fallbacks', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const config = { get: jest.fn((k: string, d?: unknown) => ({ OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'p/a:free', OPENROUTER_FALLBACK_MODELS: 'f/b:free,f/c:free,f/d:free,f/e:free' } as Record<string, unknown>)[k] ?? d) };
    await new OpenRouterService(config as never).chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.models).toEqual(['p/a:free', 'f/b:free', 'f/c:free']);
  });
});

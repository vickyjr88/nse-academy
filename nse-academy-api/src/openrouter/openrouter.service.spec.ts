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
    expect(body.model).toBe('inclusionai/ling-3.0-flash-fin:free');
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
});

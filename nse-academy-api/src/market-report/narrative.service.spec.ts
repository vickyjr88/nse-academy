import { NarrativeService } from './narrative.service';
import { buildFacts } from './market-facts';
import { templateNarrative } from './narrative';

const facts = buildFacts({
  sessionYmd: '2026-11-04',
  label: 'Wednesday 4 November 2026',
  shortLabel: 'Wed 4 Nov',
  weekday: 3,
  rows: [
    { ticker: 'SCOM', name: 'Safaricom', price: 30, volume: '4000000', change: '1.50' },
    { ticker: 'KCB', name: 'KCB Group', price: 50, volume: '800000', change: '-2.00' },
    { ticker: 'NCBA', name: 'NCBA Group', price: 91.75, volume: '100000', change: '4.26' },
  ],
  history: {},
  sectors: {},
});

const goodJson = () => JSON.stringify(templateNarrative(facts));
const badJson = () => JSON.stringify({ ...templateNarrative(facts), story: ['SCOM soared 88.8% on the day.', 'Second paragraph.'] });

function make(responses: (string | Error)[], hasKey = true, env: Record<string, string> = {}) {
  const queue = [...responses];
  const openRouter = {
    hasCredentials: jest.fn().mockReturnValue(hasKey),
    chatCompletionDetailed: jest.fn(async (_input: { messages: { role: string; content: string }[]; model?: string; fallbackModels?: string[] }) => {
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return { content: next as string, model: 'free/test-model:free' };
    }),
  };
  const config = { get: jest.fn((k: string) => env[k]) };
  return { service: new NarrativeService(openRouter as never, config as never), openRouter };
}

describe('NarrativeService.write', () => {
  it('accepts an AI narrative that passes verification and records the model that wrote it', async () => {
    const { service, openRouter } = make([goodJson()]);
    const r = await service.write(facts);
    expect(r).toMatchObject({ aiGenerated: true, model: 'free/test-model:free' });
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(1);
  });

  it('on a rejected first attempt, tells the model exactly what was wrong and accepts a corrected second attempt', async () => {
    const { service, openRouter } = make([badJson(), goodJson()]);
    const r = await service.write(facts);
    expect(r.aiGenerated).toBe(true);
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(2);
    const secondCall = openRouter.chatCompletionDetailed.mock.calls[1][0];
    const feedback = secondCall.messages[secondCall.messages.length - 1];
    expect(feedback.role).toBe('user');
    expect(feedback.content).toContain('88.8%');
  });

  it('falls back to the template - never to unverified AI text - after repeated failures, keeping the reasons', async () => {
    const { service, openRouter } = make([badJson(), badJson(), badJson()]);
    const r = await service.write(facts);
    expect(r.aiGenerated).toBe(false);
    expect(r.narrative).toEqual(templateNarrative(facts));
    expect(r.note).toMatch(/failed verification/);
    expect(r.problems?.join('|')).toContain('88.8%');
    expect(openRouter.chatCompletionDetailed).toHaveBeenCalledTimes(3);
  });

  it('treats non-JSON output as a failure to retry, not a crash', async () => {
    const { service } = make(['I am sorry, I cannot help with that.', goodJson()]);
    expect((await service.write(facts)).aiGenerated).toBe(true);
  });

  it('uses the template (and does not call the AI) when no API key is configured', async () => {
    const { service, openRouter } = make([], false);
    const r = await service.write(facts);
    expect(r).toMatchObject({ aiGenerated: false, model: null });
    expect(r.note).toMatch(/OPENROUTER_API_KEY/);
    expect(openRouter.chatCompletionDetailed).not.toHaveBeenCalled();
  });

  it('uses the template when the AI request itself fails (rate limit, outage) instead of throwing', async () => {
    const { service } = make([new Error('429 rate limited')]);
    const r = await service.write(facts);
    expect(r.aiGenerated).toBe(false);
    expect(r.note).toMatch(/request failed/);
  });
});

describe('NarrativeService model selection', () => {
  it('uses the report-specific model and fallbacks when MARKET_REPORT_MODEL is set', async () => {
    const { service, openRouter } = make([goodJson()], true, { MARKET_REPORT_MODEL: 'anthropic/claude-haiku-5.5', MARKET_REPORT_FALLBACK_MODELS: ' openai/gpt-6-luna , deepseek/deepseek-v4-flash ' });
    await service.write(facts);
    expect(openRouter.chatCompletionDetailed.mock.calls[0][0]).toMatchObject({ model: 'anthropic/claude-haiku-5.5', fallbackModels: ['openai/gpt-6-luna', 'deepseek/deepseek-v4-flash'] });
  });

  it('a report model with no fallbacks means no fallbacks - it must not inherit the free-model chain', async () => {
    const { service, openRouter } = make([goodJson()], true, { MARKET_REPORT_MODEL: 'anthropic/claude-haiku-5.5' });
    await service.write(facts);
    expect(openRouter.chatCompletionDetailed.mock.calls[0][0].fallbackModels).toEqual([]);
  });

  it('leaves the model to the global OPENROUTER settings when MARKET_REPORT_MODEL is unset', async () => {
    const { service, openRouter } = make([goodJson()]);
    await service.write(facts);
    const arg = openRouter.chatCompletionDetailed.mock.calls[0][0];
    expect(arg.model).toBeUndefined();
    expect(arg.fallbackModels).toBeUndefined();
  });
});

describe('NarrativeService.validate (editor-supplied narrative)', () => {
  const { service } = make([]);

  it('holds a human-written narrative to the same numeric rules as the AI', () => {
    const wrong = { ...templateNarrative(facts), story: ['SCOM rose 99.9%.', 'ok'] };
    const r = service.validate(wrong, facts);
    expect(r.narrative).toBeNull();
    expect(r.problems.join('|')).toContain('99.9%');
  });

  it('accepts a correct one', () => {
    expect(service.validate(templateNarrative(facts), facts).narrative).not.toBeNull();
  });

  it('reports structural problems for garbage input', () => {
    expect(service.validate({ headline: 'x' }, facts).problems.length).toBeGreaterThan(0);
    expect(service.validate(undefined, facts).narrative).toBeNull();
  });
});

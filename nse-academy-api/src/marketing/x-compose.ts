/**
 * Rewrites a finished draft with the cheapest model on the account.
 * The market-report model is deliberately not used: a tweet rewrite is short,
 * and a free model that fails the checker costs nothing because the draft stands.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageService } from '../monitoring/ai-usage.service';
import { OpenRouterService } from '../openrouter/openrouter.service';
import { hasRoboticPunctuation, plainCopy } from './plain-copy';

/** Free router. OpenRouter picks a model with a $0 price, which is the cheapest call available. */
export const DEFAULT_X_POST_MODEL = 'openrouter/free';
/** Used only when the free router errors. Also $0. */
export const DEFAULT_X_POST_FALLBACK = 'nvidia/nemotron-3-ultra-550b-a55b:free';

const ADVICE = [
  /\byou should (?:buy|sell|hold|invest|avoid)\b/i,
  /\bwe (?:recommend|suggest|advise)\b/i,
  /\bprice target\b/i,
  /\bguaranteed?\b/i,
  /\b(?:buy|sell|hold) (?:now|today|this)\b/i,
  /\bwill (?:rise|fall|rally|crash|go up|go down)\b/i,
];

const SENTIMENT = [/\b(?:bullish|bearish|panic\w*|rally|rallied|crash(?:ed|es)?|plunge[sd]?|soar(?:ed|s)?)\b/i];

const CAUSE = [/\b(?:due to|because of|thanks to|driven by|amid)\b/i, /\bnews\b/i];

/** Empty when the text is safe to keep. `source` is the only place a number may come from. */
export function tweetProblems(text: string, source: string, mode: 'market' | 'stream'): string[] {
  const problems: string[] = [];
  const limit = mode === 'stream' ? 250 : 280;
  if (text.length > limit) problems.push(`longer than ${limit} characters`);
  if (!text.trim()) problems.push('empty');
  if (hasRoboticPunctuation(text)) problems.push('dashes or fancy punctuation');
  for (const pattern of ADVICE) {
    if (pattern.test(text)) problems.push('advice');
  }
  if (mode === 'market') {
    for (const pattern of [...SENTIMENT, ...CAUSE]) {
      if (pattern.test(text)) problems.push('wording the prices do not support');
    }
  }
  for (const match of text.match(/\d+(?:\.\d+)?/g) ?? []) {
    const value = Number(match);
    if (value >= 2000 && value <= 2100) continue;
    if (!source.includes(match)) problems.push(`number ${match} is not in the source`);
  }
  return problems;
}

export function stripModelText(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

@Injectable()
export class XComposeService {
  private readonly logger = new Logger(XComposeService.name);

  constructor(
    private openRouter: OpenRouterService,
    private config: ConfigService,
    private aiUsage: AiUsageService,
  ) {}

  /**
   * Returns `draft` unchanged when AI is not configured, the call fails, or the
   * reply fails the checker. Callers invoke this only on the paths that need a rewrite.
   */
  async rewrite(draft: string, source: string, mode: 'market' | 'stream', detail: string): Promise<string> {
    if (!this.openRouter.hasCredentials()) return draft;
    const model = this.config.get<string>('X_POST_MODEL')?.trim() || DEFAULT_X_POST_MODEL;
    const fallbackModels = (this.config.get<string>('X_POST_FALLBACK_MODELS') ?? DEFAULT_X_POST_FALLBACK)
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
      .slice(0, 2);
    const started = Date.now();
    try {
      const result = await this.openRouter.chatCompletionDetailed({
        model,
        fallbackModels,
        temperature: 0.2,
        timeoutMs: 20_000,
        messages: [
          {
            role: 'system',
            content: [
              'You rewrite one short post for an investor who follows the Nairobi Securities Exchange and talks about it plainly, like a person on X.',
              'Sound natural and conversational: short sentences, no corporate phrasing, no hashtags, and never use dashes of any kind.',
              'Keep the comparisons with the past and the plain reading of the numbers that are already in the draft.',
              'Use only numbers that already appear in SOURCE. Do not add advice, predictions, price targets, or a reason prices moved.',
              mode === 'stream'
                ? 'The post comments on someone else\'s post. Stay under 240 characters. Do not invent what the original post did not say.'
                : 'Stay under 260 characters. Keep the educational tone. Do not use the words bullish, bearish, rally, crash, plunge, or soar.',
              'Output the post text only, with no quotes and no hashtags.',
            ].join(' '),
          },
          { role: 'user', content: `SOURCE:\n${source}\n\nDRAFT:\n${draft}` },
        ],
      });
      const text = plainCopy(stripModelText(result.content));
      const problems = tweetProblems(text, source, mode);
      await this.aiUsage.record({
        feature: 'x-post',
        model: result.model,
        ok: problems.length === 0,
        verified: problems.length === 0,
        durationMs: Date.now() - started,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        costUsd: result.usage.costUsd,
        detail: problems.length ? `${detail}: ${problems.join('; ')}` : detail,
      });
      if (problems.length) {
        this.logger.warn(`X rewrite dropped (${problems.join('; ')}). The draft stands.`);
        return draft;
      }
      return text;
    } catch (err) {
      await this.aiUsage.record({
        feature: 'x-post',
        model,
        ok: false,
        verified: false,
        durationMs: Date.now() - started,
        detail: `${detail}: ${(err as Error).message}`.slice(0, 300),
      });
      this.logger.warn(`X rewrite failed, using the draft: ${(err as Error).message}`);
      return draft;
    }
  }
}

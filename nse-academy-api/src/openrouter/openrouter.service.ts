import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** OpenRouter rejects a `models` array longer than this ("'models' array must have 3 items or fewer"). */
export const MAX_MODEL_CHAIN = 3;

export interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  /** The model that actually answered - differs from the requested one when a fallback was used. */
  model?: string;
  error?: { message?: string };
}

/**
 * Thin, network-safe wrapper around OpenRouter's chat-completions API
 * (https://openrouter.ai/api/v1/chat/completions) - an OpenAI-compatible
 * proxy across many providers/models, used here instead of calling any one
 * provider (Gemini, OpenAI, Anthropic, ...) directly so the model can be
 * swapped via config without a code/SDK change.
 *
 * OPENROUTER_MODEL is intentionally not hardcoded to a specific model id:
 * OpenRouter's free-tier model roster changes over time (models are added,
 * removed, or reprice), so a hardcoded "best free model" would go stale.
 * The default below is a free model that was serving requests when this was
 * last checked (the previous default was retired by OpenRouter without
 * notice) - set OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODELS in env whenever
 * a better or more reliable option appears.
 */
@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly fallbackModels: string[];
  private readonly siteUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENROUTER_API_KEY') ?? '';
    this.defaultModel = this.config.get<string>(
      'OPENROUTER_MODEL',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    );
    // Free-tier models are rate limited (and come and go), so a comma-separated
    // OPENROUTER_FALLBACK_MODELS list is tried in order when the primary errors.
    this.fallbackModels = (this.config.get<string>('OPENROUTER_FALLBACK_MODELS') ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    this.siteUrl =
      this.config.get<string>('WEB_URL') ??
      this.config.get<string>('SITE_URL') ??
      'https://nseacademy.vitaldigitalmedia.net';
  }

  /** Primary first, then fallbacks, capped at what OpenRouter accepts - extra entries are ignored rather than failing every request. */
  private modelChain(primary: string, fallbacks: string[]): string[] {
    const chain = [primary, ...fallbacks];
    if (chain.length > MAX_MODEL_CHAIN) {
      this.logger.warn(`OPENROUTER_FALLBACK_MODELS lists more than ${MAX_MODEL_CHAIN - 1} fallbacks - using only the first ${MAX_MODEL_CHAIN - 1}`);
    }
    return chain.slice(0, MAX_MODEL_CHAIN);
  }

  hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Non-streaming chat completion. `model` overrides OPENROUTER_MODEL for
   * this call only - callers that need a specific model for one request
   * (rather than the configured default) can pass it explicitly.
   */
  async chatCompletion(input: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
  }): Promise<string> {
    return (await this.chatCompletionDetailed(input)).content;
  }

  /** Like chatCompletion, but also reports which model answered (relevant when a fallback kicked in). */
  async chatCompletionDetailed(input: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    /** Abort if OpenRouter has not answered by then. Long generations (a full report) need more than the default. */
    timeoutMs?: number;
    /** Replaces OPENROUTER_FALLBACK_MODELS for this call ([] = none) - lets one feature run on its own model chain. */
    fallbackModels?: string[];
  }): Promise<{ content: string; model: string }> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI service not configured');
    }
    const primary = input.model ?? this.defaultModel;
    const fallbacks = input.fallbackModels ?? this.fallbackModels;
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          // Optional but recommended by OpenRouter for attributing usage.
          'HTTP-Referer': this.siteUrl,
          'X-Title': 'NSE Academy',
        },
        body: JSON.stringify({
          // With fallbacks configured, OpenRouter's `models` array (priority
          // order) replaces `model`; the response says which one answered.
          ...(fallbacks.length ? { models: this.modelChain(primary, fallbacks) } : { model: primary }),
          messages: input.messages,
          temperature: input.temperature,
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
      });
      const json: ChatCompletionResponse = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || `HTTP ${response.status}`);
      }
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter response had no completion content');
      }
      return { content, model: json.model ?? primary };
    } catch (err) {
      this.logger.error(`OpenRouter chat completion failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('AI analysis temporarily unavailable. Please try again.');
    }
  }
}

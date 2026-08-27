import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
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
 * The default below is a reasonable free, finance-oriented model as of when
 * this was written - override it in env whenever a better option appears.
 */
@Injectable()
export class OpenRouterService {
  private readonly logger = new Logger(OpenRouterService.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly siteUrl: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENROUTER_API_KEY') ?? '';
    this.defaultModel = this.config.get<string>(
      'OPENROUTER_MODEL',
      'inclusionai/ling-3.0-flash-fin:free',
    );
    this.siteUrl =
      this.config.get<string>('WEB_URL') ??
      this.config.get<string>('SITE_URL') ??
      'https://nseacademy.vitaldigitalmedia.net';
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
    if (!this.apiKey) {
      throw new InternalServerErrorException('AI service not configured');
    }
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
          model: input.model ?? this.defaultModel,
          messages: input.messages,
          temperature: input.temperature,
        }),
      });
      const json: ChatCompletionResponse = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || `HTTP ${response.status}`);
      }
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenRouter response had no completion content');
      }
      return content;
    } catch (err) {
      this.logger.error(`OpenRouter chat completion failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('AI analysis temporarily unavailable. Please try again.');
    }
  }
}

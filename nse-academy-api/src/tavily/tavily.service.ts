import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

export interface TavilySearchResponse {
  results: TavilyResult[];
}

/**
 * Thin wrapper around Tavily's search API (https://api.tavily.com/search),
 * used to ground AI-generated analysis in current information - replaces
 * Gemini's built-in googleSearch tool, which OpenRouter (a completions
 * proxy across many models) has no equivalent for.
 *
 * Unlike PaystackService/OpenRouterService, a search failure here degrades
 * gracefully (empty results) rather than throwing: the calling feature can
 * still produce an answer from the model's own knowledge without live
 * grounding, which is a better failure mode than a hard 500.
 */
@Injectable()
export class TavilyService {
  private readonly logger = new Logger(TavilyService.name);
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('TAVILY_API_KEY') ?? '';
  }

  hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  async search(input: {
    query: string;
    topic?: 'general' | 'news' | 'finance';
    timeRange?: 'day' | 'week' | 'month' | 'year';
    maxResults?: number;
  }): Promise<TavilyResult[]> {
    if (!this.apiKey) return [];
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input.query,
          topic: input.topic ?? 'general',
          time_range: input.timeRange,
          max_results: input.maxResults ?? 5,
          search_depth: 'basic',
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json: TavilySearchResponse = await response.json();
      return json.results ?? [];
    } catch (err) {
      this.logger.error(`Tavily search failed for "${input.query}": ${(err as Error).message}`);
      return [];
    }
  }
}

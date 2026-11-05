import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterService, ChatMessage } from '../openrouter/openrouter.service';
import { MarketFacts } from './market-facts';
import { Narrative, buildPrompt, parseNarrative, templateNarrative, verifyNarrative } from './narrative';

export interface NarrativeResult {
  narrative: Narrative;
  /** true only when an AI wrote it AND it passed verification. */
  aiGenerated: boolean;
  model: string | null;
  /** Why the template was used instead, when it was. */
  note?: string;
  problems?: string[];
}

// Haiku passes the verifier first time roughly one run in three and nearly always on the corrected retry; a third try is cheap insurance against the template.
const MAX_ATTEMPTS = 3;

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);

  constructor(
    private openRouter: OpenRouterService,
    private config: ConfigService,
  ) {}

  /**
   * The report runs on its own model chain (MARKET_REPORT_MODEL / _FALLBACK_MODELS)
   * so it can use a reliable low-cost paid model while the user-facing stock
   * advisor, which any logged-in user can trigger, stays on the free default.
   * Unset = inherit OPENROUTER_MODEL and its fallbacks.
   */
  private modelChain(): { model?: string; fallbackModels?: string[] } {
    const model = this.config.get<string>('MARKET_REPORT_MODEL')?.trim();
    if (!model) return {};
    const fallbackModels = (this.config.get<string>('MARKET_REPORT_FALLBACK_MODELS') ?? '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    return { model, fallbackModels };
  }

  /**
   * Asks the AI for the story, checks it against the facts, and - if it can't
   * produce a verified one in MAX_ATTEMPTS - returns the deterministic
   * template instead. It never returns unverified AI text, and never throws:
   * the report always gets published with something correct.
   */
  async write(facts: MarketFacts): Promise<NarrativeResult> {
    if (!this.openRouter.hasCredentials()) {
      return { narrative: templateNarrative(facts), aiGenerated: false, model: null, note: 'OPENROUTER_API_KEY is not set - used the template story' };
    }

    const { system, user } = buildPrompt(facts);
    let messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
    let lastProblems: string[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let content: string;
      let model: string;
      try {
        ({ content, model } = await this.openRouter.chatCompletionDetailed({ messages, temperature: 0.4, timeoutMs: 90_000, ...this.modelChain() }));
      } catch (err) {
        this.logger.error(`AI request failed on attempt ${attempt}: ${(err as Error).message}`);
        return { narrative: templateNarrative(facts), aiGenerated: false, model: null, note: 'The AI request failed - used the template story' };
      }

      const parsed = parseNarrative(content);
      const problems = parsed.narrative ? verifyNarrative(parsed.narrative, facts) : parsed.errors;
      if (parsed.narrative && problems.length === 0) {
        this.logger.log(`AI narrative accepted on attempt ${attempt} (${model})`);
        return { narrative: parsed.narrative, aiGenerated: true, model };
      }

      lastProblems = problems;
      this.logger.warn(`AI narrative rejected on attempt ${attempt}: ${problems.slice(0, 5).join('; ')}`);
      messages = [
        ...messages,
        { role: 'assistant', content },
        { role: 'user', content: `Your output was rejected for these reasons: ${problems.slice(0, 8).join('; ')}. Fix every one and return the complete JSON object again, using only numbers from FACTS.` },
      ];
    }

    return {
      narrative: templateNarrative(facts),
      aiGenerated: false,
      model: null,
      note: `AI output failed verification after ${MAX_ATTEMPTS} attempts - used the template story`,
      problems: lastProblems,
    };
  }

  /** Validates a narrative supplied by a human/editor with the exact same rules the AI is held to. */
  validate(candidate: unknown, facts: MarketFacts): { narrative: Narrative | null; problems: string[] } {
    const parsed = parseNarrative(JSON.stringify(candidate ?? {}));
    if (!parsed.narrative) return { narrative: null, problems: parsed.errors };
    const problems = verifyNarrative(parsed.narrative, facts);
    return { narrative: problems.length ? null : parsed.narrative, problems };
  }
}

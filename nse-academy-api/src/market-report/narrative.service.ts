import { Injectable, Logger } from '@nestjs/common';
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

const MAX_ATTEMPTS = 2;

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);

  constructor(private openRouter: OpenRouterService) {}

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
        ({ content, model } = await this.openRouter.chatCompletionDetailed({ messages, temperature: 0.4, timeoutMs: 90_000 }));
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

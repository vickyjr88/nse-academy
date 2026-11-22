/** Pure helpers for the filtered stream and the morning recent-search backfill. */

export interface StreamRuleRef {
  tag: string;
  value: string;
}

export interface ExistingRule extends StreamRuleRef {
  id: string;
}

export function ruleDiff(desired: StreamRuleRef[], existing: ExistingRule[]): { add: StreamRuleRef[]; deleteIds: string[] } {
  const key = (tag: string, value: string) => `${tag}\n${value}`;
  const have = new Map(existing.map((rule) => [key(rule.tag, rule.value), rule.id]));
  const want = new Set(desired.map((rule) => key(rule.tag, rule.value)));
  return {
    add: desired.filter((rule) => !have.has(key(rule.tag, rule.value))),
    deleteIds: existing.filter((rule) => !want.has(key(rule.tag, rule.value))).map((rule) => rule.id),
  };
}

export function spendAllows(input: { todayPosts: number; monthUsd: number; dailyPostCap: number; monthlyUsdCap: number; unitUsd: number }): boolean {
  if (input.todayPosts >= input.dailyPostCap) return false;
  if (input.monthUsd + input.unitUsd > input.monthlyUsdCap + 1e-9) return false;
  return true;
}

export function spendBuckets(ymd: string): { day: string; month: string } {
  return { day: ymd, month: `m:${ymd.slice(0, 7)}` };
}

/** Recent search accepts 512 characters. A joined rule list that does not fit falls back to the first rule. */
export function searchQueryFromRules(rules: StreamRuleRef[]): string | null {
  if (rules.length === 0) return null;
  const joined = rules.map((rule) => `(${rule.value})`).join(' OR ');
  return joined.length <= 512 ? joined : rules[0].value;
}

export interface StreamPost {
  id: string;
  text: string;
  tag: string | null;
}

/** One NDJSON line from the filtered stream. Blank keepalives are null. Error lines surface the message. */
export function parseStreamLine(line: string): StreamPost | { error: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { error: 'stream line was not JSON' };
  }
  if (!json || typeof json !== 'object') return { error: 'stream line was empty' };
  const body = json as { errors?: { message?: string }[]; data?: { id?: unknown; text?: unknown }; matching_rules?: { tag?: unknown }[] };
  if (Array.isArray(body.errors) && body.errors.length) {
    return { error: body.errors.map((e) => e.message).filter(Boolean).join('; ') || 'stream error' };
  }
  const id = body.data?.id;
  const text = body.data?.text;
  if (typeof id !== 'string' || typeof text !== 'string') return null;
  const tag = body.matching_rules?.find((rule) => typeof rule.tag === 'string')?.tag;
  return { id, text, tag: typeof tag === 'string' ? tag : null };
}

/** The draft we keep when the model is off or fails the checker. No digits, so it cannot invent a figure. */
export function streamCommentary(tag: string | null): string {
  if (tag === 'official') return 'Official NSE post. Read the original before treating it as a fact about a stock.';
  if (tag === 'desk') return 'A market desk posted on the NSE. Read the original and check it against the exchange announcement.';
  return 'NSE chatter on X. Check the primary source before you rely on it.';
}

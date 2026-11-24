/**
 * The X sentence is the source of truth for every platform. These pure helpers
 * add each platform's closing line and hashtags, then respect that platform's
 * real limit. No database and no network: the automation service and the manual
 * poster both call the same functions, and the tests pin the edge cases.
 */
import { PlatformTarget, SocialPlatform } from './x-automation.config';
import { plainCopy } from './plain-copy';

export interface CardSet {
  /** The vertical 9:16 story cards. */
  story: string[];
  /** The same cards at 4:5, which is what Instagram's feed accepts. */
  feed: string[];
}

/** Which of a report's cards each platform takes, and how many. */
export function mediaForPlatform(platform: SocialPlatform, cards: CardSet): string[] {
  if (platform === 'x') return cards.story.slice(0, 4);
  if (platform === 'facebook' || platform === 'threads') return cards.story.slice(0, 1);
  if (platform === 'instagram') return cards.feed.slice(0, 10);
  if (platform === 'tiktok') return cards.story.slice(0, 35);
  return [];
}

export const PLATFORM_TEXT_LIMIT: Record<SocialPlatform, number> = {
  // The X account is verified, so it can post long-form instead of the old 280 characters.
  x: 4000,
  facebook: 63206,
  instagram: 2200,
  threads: 500,
  tiktok: 4000,
};

/** TikTok photo posts keep a short headline and a separate description. */
export const TIKTOK_TITLE_LIMIT = 90;

/** Hashtags are a tag list, not prose. Bad input is ignored rather than posted as a sentence. */
function tags(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((tag) => tag.trim().replace(/^#+/, ''))
    .filter((tag) => /^[A-Za-z0-9_]+$/.test(tag))
    .map((tag) => `#${tag}`);
}

/** Adds only tags the post does not already carry, case-insensitively. */
export function addHashtags(text: string, hashtags: string): string {
  const existing = new Set((text.match(/#[A-Za-z0-9_]+/g) ?? []).map((tag) => tag.toLowerCase()));
  const missing = tags(hashtags).filter((tag) => !existing.has(tag.toLowerCase()));
  return missing.length ? `${text.trimEnd()}\n\n${missing.join(' ')}` : text.trimEnd();
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  // Keep a trailing link intact when there is room for it, so a shortened post still points at the report.
  const link = /https?:\/\/\S+$/.exec(text)?.[0];
  if (link && link.length + 2 < limit) {
    return `${text.slice(0, limit - link.length - 2).trimEnd()}… ${link}`;
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

/**
 * The same story, dressed for one platform. The suffix and hashtags are added
 * only when they fit; the base sentence is never dropped in favour of them.
 */
export function platformText(platform: SocialPlatform, base: string, target: PlatformTarget): string {
  const limit = PLATFORM_TEXT_LIMIT[platform];
  const source = plainCopy(base);
  if (!source) return '';

  const suffix = plainCopy(target.suffix);
  const withSuffix = suffix && !source.toLowerCase().includes(suffix.toLowerCase()) ? `${source}\n\n${suffix}` : source;
  const full = addHashtags(withSuffix, target.hashtags);
  if (full.length <= limit) return full;

  const withoutHashtags = withSuffix.length <= limit ? withSuffix : source;
  if (withoutHashtags.length <= limit) return withoutHashtags;

  return truncate(source, limit);
}

/** TikTok wants a 90-character title plus a longer description. */
export function tiktokFields(base: string, target: PlatformTarget): { title: string; description: string } {
  const description = platformText('tiktok', base, target);
  const firstLine = description.split(/\r?\n/).find((line) => line.trim()) ?? description;
  const title = firstLine.replace(/\s+/g, ' ').trim().slice(0, TIKTOK_TITLE_LIMIT);
  return { title, description };
}

/**
 * Every post passes through here last. Long dashes, middle dots and curly quotes are the fastest tell that a post was
 * machine-written, so they are removed whatever produced the text: a template, the AI rewrite, the daily report or a
 * hand-typed post. Pure, no database.
 */

const DASHES = /[—―⸺⸻]/; // em dash, horizontal bar, two-em and three-em dashes
const EN_DASH = /–/;

/** True when the text still carries a dash a person would not type on a phone. */
export function hasRoboticPunctuation(text: string): boolean {
  return DASHES.test(text) || EN_DASH.test(text) || /·/.test(text);
}

/**
 * A spaced em dash is a pause, so it becomes a comma, or a full stop when a new sentence clearly starts after it.
 * An unspaced one joins two words and becomes a comma too. An en dash between digits is a range ("9-10"); between
 * words it is a pause. Middle dots become commas. Curly quotes and the ellipsis character become plain ones.
 */
export function plainCopy(text: string): string {
  let out = text
    // "Closing bell — NSE Tue ..." : a label followed by a capital starts a new sentence.
    .replace(/\s+[—―⸺⸻]\s+(?=[A-Z0-9])/g, '. ')
    .replace(/\s*[—―⸺⸻]\s*/g, ', ')
    // numeric range: 9–10, KSh 5–6
    .replace(/(\d)\s*–\s*(?=\d)/g, '$1-')
    .replace(/\s+–\s+/g, ', ')
    .replace(/–/g, '-')
    // "Midday session · Spotlight"
    .replace(/\s*·\s*/g, ', ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');

  // Tidy what the replacements can leave behind.
  out = out
    .replace(/,\s*,/g, ',')
    .replace(/\.\s+\./g, '.')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n');
  return out.trim();
}

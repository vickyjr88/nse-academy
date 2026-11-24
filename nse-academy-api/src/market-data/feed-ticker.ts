/**
 * The price feed occasionally sends a listed company with an empty ticker (QuickMart Plc arrived like that from the
 * day it started trading). Known ones are filled in by name; any other row without a ticker is dropped rather than
 * stored, because a blank ticker cannot be priced, charted, alerted on or shown on the heatmap.
 */
const TICKER_BY_NAME: Record<string, string> = {
  quickmart: 'QMRT',
};

const key = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(plc|ltd|limited|ord\.?|ordinary)\b/g, '')
    .replace(/[^a-z0-9]+/g, '');

/** The ticker to store for a feed row, or null when the row cannot be identified. */
export function resolveFeedTicker(ticker: string | null | undefined, name: string | null | undefined): string | null {
  const given = (ticker ?? '').trim().toUpperCase();
  if (given) return given;
  return TICKER_BY_NAME[key(name ?? '')] ?? null;
}

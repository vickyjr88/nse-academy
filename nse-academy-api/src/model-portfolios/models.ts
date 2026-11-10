// Model portfolios: validation, performance and comparison. Pure, like the rest of the allocation maths. A model is an
// illustration to study and copy, so every number here is worked out from stored closes and stated with its limits.

import { DailyClose } from '../market-data/price-history';

export const RISK_PROFILES = ['conservative', 'moderate', 'aggressive', 'dividend', 'growth'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

export interface ModelHoldingInput {
  ticker: string;
  weightPct: number;
  rationale?: string | null;
}

export interface ModelInput {
  slug: string;
  name: string;
  summary: string;
  description: string;
  riskProfile?: string | null;
  inceptionDate: string;
  holdings: ModelHoldingInput[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const TICKER = /^[A-Z0-9.]{1,12}$/;

/** What is wrong with a model, in words an editor can act on. Empty means it can be saved. */
export function validateModel(m: ModelInput): string[] {
  const p: string[] = [];
  if (!SLUG.test(m.slug) || m.slug.length > 60) p.push('The address (slug) must be lowercase words joined by hyphens, up to 60 characters.');
  if (!m.name.trim() || m.name.length > 80) p.push('Give the model a name of up to 80 characters.');
  if (!m.summary.trim() || m.summary.length > 200) p.push('Write a one-sentence summary of up to 200 characters.');
  if (!m.description.trim()) p.push('Describe who the model is for and how it is built.');
  if (m.riskProfile && !RISK_PROFILES.includes(m.riskProfile as RiskProfile)) p.push(`Risk profile must be one of: ${RISK_PROFILES.join(', ')}.`);
  if (!YMD.test(m.inceptionDate) || Number.isNaN(Date.parse(`${m.inceptionDate}T00:00:00Z`))) p.push('The inception date must be a real date, YYYY-MM-DD.');
  if (m.holdings.length < 2 || m.holdings.length > 15) p.push('A model holds between 2 and 15 stocks.');
  const seen = new Set<string>();
  for (const h of m.holdings) {
    if (!TICKER.test(h.ticker)) p.push(`"${h.ticker}" is not a valid stock code.`);
    if (seen.has(h.ticker)) p.push(`${h.ticker} appears twice.`);
    seen.add(h.ticker);
    if (!(h.weightPct >= 1 && h.weightPct <= 60)) p.push(`${h.ticker} needs a weight from 1% to 60%, so no single stock dominates.`);
  }
  const sum = m.holdings.reduce((s, h) => s + h.weightPct, 0);
  if (Math.abs(sum - 100) > 0.01) p.push(`The weights add up to ${Math.round(sum * 100) / 100}%. They must add up to exactly 100%.`);
  return p;
}

export interface ModelPerformance {
  inceptionDate: string;
  asOf: string;
  /** Percent since inception for a buy-and-hold of the model's weights. */
  sincePct: number;
  /** Percent over the last 30 days, when history allows. */
  last30Pct: number | null;
  /** Value of 100 invested at inception, oldest first, at most ~60 points. */
  series: { date: string; value: number }[];
  /** Stocks left out because they have no close on or after inception. Empty when the number is complete. */
  missing: string[];
}

/**
 * Buy-and-hold from the inception day: 100 invested in the stated weights, no rebalancing, no fees, no dividends.
 * Null when any holding has no usable history, so a partial number is never shown as the whole portfolio.
 */
export function modelPerformance(holdings: ModelHoldingInput[], series: Map<string, DailyClose[]>, inceptionYmd: string): ModelPerformance | null {
  const sorted = new Map<string, DailyClose[]>();
  const missing: string[] = [];
  for (const h of holdings) {
    const s = (series.get(h.ticker) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (s.length === 0 || !s.some((c) => c.date >= inceptionYmd)) missing.push(h.ticker);
    else sorted.set(h.ticker, s);
  }
  if (missing.length) return null;

  const start = new Map<string, number>();
  for (const [t, s] of sorted) {
    const first = s.find((c) => c.date >= inceptionYmd) as DailyClose;
    // The stock must have been priced within a week of inception, or the base is not the inception price.
    if (Date.parse(first.date) - Date.parse(inceptionYmd) > 7 * 86_400_000) return null;
    start.set(t, first.price);
  }

  // Every date any holding traded on, from inception on; a stock keeps its last close on days it did not trade.
  const dates = [...new Set([...sorted.values()].flatMap((s) => s.map((c) => c.date)).filter((d) => d >= inceptionYmd))].sort();
  const valueAt = (date: string): number => {
    let v = 0;
    for (const h of holdings) {
      const s = sorted.get(h.ticker) as DailyClose[];
      let price = start.get(h.ticker) as number;
      for (const c of s) {
        if (c.date > date) break;
        if (c.date >= inceptionYmd) price = c.price;
      }
      v += (h.weightPct / 100) * 100 * (price / (start.get(h.ticker) as number));
    }
    return v;
  };

  const full = dates.map((d) => ({ date: d, value: valueAt(d) }));
  if (full.length === 0) return null;
  const last = full[full.length - 1];
  const target = new Date(Date.parse(`${last.date}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  const base30 = [...full].reverse().find((p) => p.date <= target);
  const step = Math.max(1, Math.ceil(full.length / 60));
  const thinned = full.filter((_, i) => i % step === 0 || i === full.length - 1);
  return {
    inceptionDate: inceptionYmd,
    asOf: last.date,
    sincePct: last.value - 100,
    last30Pct: base30 ? ((last.value - base30.value) / base30.value) * 100 : null,
    series: thinned.map((p) => ({ date: p.date, value: Math.round(p.value * 100) / 100 })),
    missing: [],
  };
}

export interface ModelComparisonRow {
  ticker: string;
  modelPct: number;
  yourPct: number;
  /** Your weight minus the model's, in percentage points. */
  diffPct: number;
}

/** How a member's holdings line up with a model. `overlapPct` is the share of the portfolio that already matches. */
export function compareToModel(model: ModelHoldingInput[], yours: { ticker: string; weightPct: number }[]): { rows: ModelComparisonRow[]; overlapPct: number; notInModel: { ticker: string; weightPct: number }[] } {
  const mine = new Map(yours.map((y) => [y.ticker, y.weightPct]));
  const rows = model
    .map((m) => ({ ticker: m.ticker, modelPct: m.weightPct, yourPct: mine.get(m.ticker) ?? 0, diffPct: Math.round(((mine.get(m.ticker) ?? 0) - m.weightPct) * 10) / 10 }))
    .sort((a, b) => b.modelPct - a.modelPct);
  const overlap = rows.reduce((s, r) => s + Math.min(r.modelPct, r.yourPct), 0);
  const inModel = new Set(model.map((m) => m.ticker));
  const notInModel = yours.filter((y) => !inModel.has(y.ticker)).sort((a, b) => b.weightPct - a.weightPct);
  return { rows, overlapPct: Math.round(overlap * 10) / 10, notInModel };
}

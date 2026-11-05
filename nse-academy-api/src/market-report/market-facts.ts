import { Mover, PriceRow, formatCompact, toMovers, MIN_MOVER_VALUE_KES } from '../reports/report-helpers';

/**
 * Everything the public market report states is derived here, from stored NSE
 * prices - nothing from users, payments or accounts. The AI narrative is only
 * ever shown these facts, and the verifier rejects any number in its output
 * that is not in them, so this object is the single source of truth.
 *
 * All values are pre-rounded to the precision they are shown at, so the facts
 * the model sees, the page renders, and the verifier accepts are identical.
 */

export interface DayValue {
  ymd: string;
  /** price x volume traded that day, KSh */
  value: number;
  changePct: number;
}

export interface FactsInput {
  sessionYmd: string;
  label: string;
  shortLabel: string;
  weekday: number;
  /** Last snapshot per ticker on the session day. */
  rows: PriceRow[];
  /** Per ticker, earlier sessions oldest -> newest. */
  history: Record<string, DayValue[]>;
  /** ticker -> sector (may be empty if the CMS is unreachable). */
  sectors: Record<string, string>;
}

export interface MoverFact {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  valueKes: number;
  volume: number;
}

export interface MarketFacts {
  sessionYmd: string;
  label: string;
  shortLabel: string;
  breadth: { advancers: number; decliners: number; unchanged: number; traded: number };
  valueTradedKes: number;
  /** Average total value over up to the last 20 prior sessions; null if there is no history. */
  avgValueTradedKes: number | null;
  /** Today vs that average, in percent: +35 means 35% ABOVE average, -20 means 20% below. null if no history. */
  valueVsAvgPct: number | null;
  /** The same comparison in words - the only correct way to describe it ("35% above its recent average"). */
  valueVsAvgNote: string | null;
  previous: { sessionYmd: string; advancers: number; decliners: number; valueTradedKes: number } | null;
  gainers: MoverFact[];
  losers: MoverFact[];
  active: MoverFact[];
  /** Stocks trading at >= 2x their own 20-session average value, on at least KSh 1M. */
  volumeSpikes: { ticker: string; name: string; valueKes: number; baselineKes: number; multiple: number; changePct: number }[];
  /** Moves at or beyond the +/-9.5% region - the NSE's daily price limit is 10%. */
  limitMoves: { ticker: string; name: string; changePct: number; price: number }[];
  sectors: { sector: string; changePct: number; valueKes: number; stocks: number }[];
  /** How much of the day's total value the single most-traded stock accounted for. */
  concentration: { ticker: string; name: string; sharePct: number } | null;
}

const BASELINE_SESSIONS = 20;
const MIN_HISTORY_FOR_SPIKE = 5;
const SPIKE_MULTIPLE = 2;
const SPIKE_MIN_VALUE_KES = 1_000_000;
const LIMIT_MOVE_PCT = 9.5;

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

/**
 * The market API names stocks like "Equity Bank Ltd Ord 0.50" - the share
 * class and par value are noise on a public page, and the digits in them
 * ("0.50") look like figures to anyone, human or AI, quoting the name.
 */
export function cleanName(raw: string): string {
  return raw
    // [O0]rd: the feed has a typo'd "0rd" (zero) for NCBA
    .replace(/\s+(?:[O0]rd|Ordinary|Pref|Preference)\b.*$/i, '')
    .replace(/\s+\d+(?:\.\d+)?$/, '')
    .replace(/\bltd\b/g, 'Ltd')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFact(m: Mover): MoverFact {
  return {
    ticker: m.ticker,
    name: cleanName(m.name),
    price: round(m.price, 2),
    changePct: round(m.changePct, 2),
    valueKes: Math.round(m.value),
    volume: Math.round(m.volume),
  };
}

export function buildFacts(input: FactsInput): MarketFacts {
  const movers = toMovers(input.rows);
  const traded = movers.filter((m) => m.volume > 0);
  const liquid = traded.filter((m) => m.value >= MIN_MOVER_VALUE_KES);
  const totalValue = traded.reduce((s, m) => s + m.value, 0);

  // ---- baseline + previous session, from each ticker's own history
  const byDay = new Map<string, { value: number; adv: number; dec: number }>();
  for (const days of Object.values(input.history)) {
    for (const d of days) {
      const cur = byDay.get(d.ymd) ?? { value: 0, adv: 0, dec: 0 };
      cur.value += d.value;
      if (d.value > 0) {
        if (d.changePct > 0) cur.adv++;
        else if (d.changePct < 0) cur.dec++;
      }
      byDay.set(d.ymd, cur);
    }
  }
  const priorDays = [...byDay.keys()].sort();
  const recent = priorDays.slice(-BASELINE_SESSIONS);
  const avgValue = recent.length ? recent.reduce((s, d) => s + byDay.get(d)!.value, 0) / recent.length : null;
  const prevYmd = priorDays[priorDays.length - 1];
  const prev = prevYmd ? byDay.get(prevYmd)! : null;

  // ---- volume spikes vs each stock's own baseline
  const spikes = traded
    .map((m) => {
      const hist = (input.history[m.ticker] ?? []).slice(-BASELINE_SESSIONS);
      if (hist.length < MIN_HISTORY_FOR_SPIKE) return null;
      const baseline = hist.reduce((s, d) => s + d.value, 0) / hist.length;
      if (baseline <= 0 || m.value < SPIKE_MIN_VALUE_KES) return null;
      const multiple = m.value / baseline;
      return multiple >= SPIKE_MULTIPLE
        ? { ticker: m.ticker, name: cleanName(m.name), valueKes: Math.round(m.value), baselineKes: Math.round(baseline), multiple: round(multiple, 1), changePct: round(m.changePct, 2) }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.multiple - a.multiple)
    .slice(0, 3);

  // ---- sectors (value-weighted change, so a stock that barely traded cannot swing a sector)
  const sectorAgg = new Map<string, { w: number; wc: number; n: number }>();
  for (const m of traded) {
    const sector = input.sectors[m.ticker];
    if (!sector) continue;
    const a = sectorAgg.get(sector) ?? { w: 0, wc: 0, n: 0 };
    a.w += m.value;
    a.wc += m.value * m.changePct;
    a.n += 1;
    sectorAgg.set(sector, a);
  }
  const sectors = [...sectorAgg.entries()]
    // A sector whose stocks barely traded says nothing (one stock on KSh 34,673 once showed "-4%").
    .filter(([, a]) => a.w >= MIN_MOVER_VALUE_KES)
    .map(([sector, a]) => ({ sector, changePct: round(a.wc / a.w, 2), valueKes: Math.round(a.w), stocks: a.n }))
    .sort((a, b) => b.changePct - a.changePct);

  const vsAvgPct = avgValue && avgValue > 0 ? Math.round((totalValue / avgValue - 1) * 100) : null;
  const active = [...traded].sort((a, b) => b.value - a.value).slice(0, 5);
  const top = active[0];

  return {
    sessionYmd: input.sessionYmd,
    label: input.label,
    shortLabel: input.shortLabel,
    breadth: {
      advancers: traded.filter((m) => m.changePct > 0).length,
      decliners: traded.filter((m) => m.changePct < 0).length,
      unchanged: traded.filter((m) => m.changePct === 0).length,
      traded: traded.length,
    },
    valueTradedKes: Math.round(totalValue),
    avgValueTradedKes: avgValue === null ? null : Math.round(avgValue),
    valueVsAvgPct: vsAvgPct,
    valueVsAvgNote: vsAvgPct === null ? null : vsAvgPct >= 0 ? `${vsAvgPct}% above its recent average` : `${Math.abs(vsAvgPct)}% below its recent average`,
    previous: prev && prevYmd ? { sessionYmd: prevYmd, advancers: prev.adv, decliners: prev.dec, valueTradedKes: Math.round(prev.value) } : null,
    gainers: liquid.filter((m) => m.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5).map(toFact),
    losers: liquid.filter((m) => m.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5).map(toFact),
    active: active.map(toFact),
    volumeSpikes: spikes,
    limitMoves: traded
      .filter((m) => Math.abs(m.changePct) >= LIMIT_MOVE_PCT)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
      .slice(0, 4)
      .map((m) => ({ ticker: m.ticker, name: cleanName(m.name), changePct: round(m.changePct, 2), price: round(m.price, 2) })),
    sectors,
    concentration: top && totalValue > 0 ? { ticker: top.ticker, name: cleanName(top.name), sharePct: round((top.value / totalValue) * 100, 1) } : null,
  };
}

/** KSh amounts the way the story/page should say them: "KSh 126.0 million". */
export function kesWords(n: number): string {
  if (n >= 1e9) return `KSh ${round(n / 1e9, 2)} billion`;
  if (n >= 1e6) return `KSh ${round(n / 1e6, 1)} million`;
  if (n >= 1e3) return `KSh ${Math.round(n).toLocaleString('en-KE')}`;
  return `KSh ${Math.round(n)}`;
}

export { formatCompact };

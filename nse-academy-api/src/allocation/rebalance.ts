// Allocation and rebalancing maths. Pure: no database, clock or network, so the same functions drive the dashboard,
// the quarterly review email and the tests. Everything here is information about the member's own numbers, never a
// recommendation: the targets are theirs, and the output is "what it would take to get from here to there".

export interface Position {
  ticker: string;
  quantity: number;
  /** Last close, KSh. */
  price: number;
  /** All-in fee of the broker holding most of this stock, in percent; null when unknown. */
  feePct: number | null;
  brokerName: string | null;
}

export interface Target {
  ticker: string;
  weightPct: number;
}

export interface AllocationRow {
  ticker: string;
  sector: string | null;
  quantity: number;
  price: number;
  valueKes: number;
  /** Share of everything priced, percent. */
  weightPct: number;
}

export interface SectorRow {
  sector: string;
  valueKes: number;
  weightPct: number;
  tickers: string[];
}

export const BAND_PCT = 2; // leave a holding alone while it is within this many percentage points of its target
export const MIN_TRADE_KES = 1_000; // a smaller trade costs more in fees and attention than it fixes
export const HIGH_COST_PCT = 1; // total fees above this share of the portfolio get a warning

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** The same stock held at several brokers becomes one row; the broker with most shares sets the fee. */
export function consolidatePositions(
  raw: { ticker: string; quantity: number; price: number; feePct: number | null; brokerName: string | null }[],
): Position[] {
  const by = new Map<string, Position & { top: number }>();
  for (const p of raw) {
    if (p.quantity <= 0) continue;
    const e = by.get(p.ticker);
    if (!e) {
      by.set(p.ticker, { ...p, top: p.quantity });
      continue;
    }
    e.quantity += p.quantity;
    if (p.quantity > e.top) {
      e.top = p.quantity;
      e.feePct = p.feePct;
      e.brokerName = p.brokerName;
    }
  }
  return [...by.values()].map(({ top: _top, ...p }) => p);
}

export function allocationRows(positions: Position[], sectors: Record<string, string>): AllocationRow[] {
  const total = positions.reduce((s, p) => s + p.quantity * p.price, 0);
  return positions
    .map((p) => ({
      ticker: p.ticker,
      sector: sectors[p.ticker] ?? null,
      quantity: p.quantity,
      price: p.price,
      valueKes: p.quantity * p.price,
      weightPct: total > 0 ? ((p.quantity * p.price) / total) * 100 : 0,
    }))
    .sort((a, b) => b.valueKes - a.valueKes);
}

export function sectorExposure(rows: AllocationRow[]): SectorRow[] {
  const total = rows.reduce((s, r) => s + r.valueKes, 0);
  const by = new Map<string, SectorRow>();
  for (const r of rows) {
    const key = r.sector ?? 'Unclassified';
    const e = by.get(key) ?? { sector: key, valueKes: 0, weightPct: 0, tickers: [] };
    e.valueKes += r.valueKes;
    e.tickers.push(r.ticker);
    by.set(key, e);
  }
  return [...by.values()]
    .map((e) => ({ ...e, weightPct: total > 0 ? (e.valueKes / total) * 100 : 0 }))
    .sort((a, b) => b.valueKes - a.valueKes);
}

/** Problems with a set of targets, in words a member can act on. Empty means usable. */
export function validateTargets(targets: Target[]): string[] {
  const problems: string[] = [];
  if (targets.length === 0) return problems;
  const seen = new Set<string>();
  for (const t of targets) {
    if (!/^[A-Z0-9.]{1,12}$/.test(t.ticker)) problems.push(`"${t.ticker}" is not a valid stock code.`);
    if (seen.has(t.ticker)) problems.push(`${t.ticker} appears twice.`);
    seen.add(t.ticker);
    if (!(t.weightPct > 0 && t.weightPct <= 100)) problems.push(`${t.ticker} needs a weight above 0 and up to 100.`);
  }
  const sum = targets.reduce((s, t) => s + t.weightPct, 0);
  if (Math.abs(sum - 100) > 0.5) problems.push(`The weights add up to ${round(sum, 1)}%. They must add up to 100%.`);
  if (targets.length > 25) problems.push('Use at most 25 stocks.');
  return problems;
}

export interface DriftRow {
  ticker: string;
  currentPct: number;
  targetPct: number;
  /** Current minus target, in percentage points. */
  driftPct: number;
  valueKes: number;
}

export interface Trade {
  ticker: string;
  action: 'BUY' | 'SELL';
  shares: number;
  priceKes: number;
  valueKes: number;
  /** null when no fee is known for the broker. */
  feeKes: number | null;
  brokerName: string | null;
  fromPct: number;
  toPct: number;
}

export interface RebalancePlan {
  /** What the targets are measured against: the value of the targeted holdings plus any new cash. */
  baseKes: number;
  drift: DriftRow[];
  trades: Trade[];
  /** Holdings with no target. They are left alone and are not part of the base. */
  unassigned: { ticker: string; valueKes: number }[];
  /** Cash entered plus sells, minus buys and fees. Negative means the buys need that much more fresh cash. */
  netCashKes: number;
  totalFeesKes: number;
  feesPctOfBase: number;
  warnings: string[];
}

export interface RebalanceInput {
  positions: Position[];
  targets: Target[];
  /** Prices for targeted stocks the member does not hold yet. */
  extraPrices?: Record<string, number>;
  /** Broker fee to assume for a stock bought for the first time; null when unknown. */
  defaultFeePct?: number | null;
  defaultBrokerName?: string | null;
  cashKes?: number;
  bandPct?: number;
  minTradeKes?: number;
}

export function planRebalance(input: RebalanceInput): RebalancePlan {
  const band = input.bandPct ?? BAND_PCT;
  const minTrade = input.minTradeKes ?? MIN_TRADE_KES;
  const cash = Math.max(input.cashKes ?? 0, 0);
  const warnings: string[] = [];
  const held = new Map(input.positions.map((p) => [p.ticker, p]));
  const targeted = new Set(input.targets.map((t) => t.ticker));

  const unassigned = input.positions
    .filter((p) => !targeted.has(p.ticker))
    .map((p) => ({ ticker: p.ticker, valueKes: p.quantity * p.price }))
    .sort((a, b) => b.valueKes - a.valueKes);
  if (unassigned.length) warnings.push(`${unassigned.map((u) => u.ticker).join(', ')} ${unassigned.length === 1 ? 'is' : 'are'} not in your targets, so ${unassigned.length === 1 ? 'it is' : 'they are'} left alone.`);

  const priceOf = (ticker: string): number | null => held.get(ticker)?.price ?? input.extraPrices?.[ticker] ?? null;
  const heldValueOfTargets = input.targets.reduce((s, t) => s + (held.get(t.ticker)?.quantity ?? 0) * (held.get(t.ticker)?.price ?? 0), 0);
  const base = heldValueOfTargets + cash;

  const drift: DriftRow[] = [];
  const trades: Trade[] = [];
  if (base <= 0) {
    warnings.push('None of your targeted stocks is held yet and no cash was entered, so there is nothing to measure against. Enter an amount to invest.');
    return { baseKes: 0, drift, trades, unassigned, netCashKes: 0, totalFeesKes: 0, feesPctOfBase: 0, warnings };
  }

  for (const t of input.targets) {
    const price = priceOf(t.ticker);
    const pos = held.get(t.ticker);
    const qty = pos?.quantity ?? 0;
    const value = qty * (price ?? 0);
    const currentPct = (value / base) * 100;
    drift.push({ ticker: t.ticker, currentPct: round(currentPct, 1), targetPct: t.weightPct, driftPct: round(currentPct - t.weightPct, 1), valueKes: Math.round(value) });
    if (price == null || price <= 0) {
      warnings.push(`There is no recent price for ${t.ticker}, so it was skipped.`);
      continue;
    }
    const diff = (t.weightPct / 100) * base - value;
    if (Math.abs(currentPct - t.weightPct) < band) continue;
    let shares = Math.round(Math.abs(diff) / price);
    if (diff < 0) shares = Math.min(shares, qty);
    if (shares <= 0 || shares * price < minTrade) continue;

    const feePct = pos?.feePct ?? input.defaultFeePct ?? null;
    const valueKes = shares * price;
    const after = diff < 0 ? value - valueKes : value + valueKes;
    trades.push({
      ticker: t.ticker,
      action: diff < 0 ? 'SELL' : 'BUY',
      shares,
      priceKes: price,
      valueKes: Math.round(valueKes),
      feeKes: feePct != null ? Math.round((valueKes * feePct) / 100) : null,
      brokerName: pos?.brokerName ?? input.defaultBrokerName ?? null,
      fromPct: round(currentPct, 1),
      toPct: round((after / base) * 100, 1),
    });
  }
  trades.sort((a, b) => (a.action === b.action ? b.valueKes - a.valueKes : a.action === 'SELL' ? -1 : 1));

  const sells = trades.filter((t) => t.action === 'SELL').reduce((s, t) => s + t.valueKes, 0);
  const buys = trades.filter((t) => t.action === 'BUY').reduce((s, t) => s + t.valueKes, 0);
  const totalFees = trades.reduce((s, t) => s + (t.feeKes ?? 0), 0);
  const netCashKes = cash + sells - buys - totalFees;
  const feesPct = (totalFees / base) * 100;
  if (trades.some((t) => t.feeKes == null)) warnings.push('Some trades have no broker fee on record, so the cost shown is incomplete.');
  if (feesPct > HIGH_COST_PCT) warnings.push(`These trades would cost about ${round(feesPct, 1)}% of the portfolio in broker fees. If the drift is small, waiting may cost you less.`);
  if (netCashKes < -1) warnings.push(`The buys need about KSh ${Math.round(-netCashKes).toLocaleString('en-KE')} more than the sells and your cash cover. Add that as cash, or lower a target.`);
  warnings.push('Tax and price movement before you trade are not included.');

  return { baseKes: Math.round(base), drift, trades, unassigned, netCashKes: Math.round(netCashKes), totalFeesKes: Math.round(totalFees), feesPctOfBase: round(feesPct, 2), warnings };
}

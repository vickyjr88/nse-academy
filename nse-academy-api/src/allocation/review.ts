// The quarterly portfolio review email (Premium): where the money is, how the shares held today did over the last
// quarter, how far each stock has drifted from the member's own targets, and what it would take to get back, with
// broker costs. Pure, like rebalance.ts. Information about the member's own numbers, never a recommendation.

import { escapeHtml, renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { dataTable, sectionHeading, signedPct, statRows } from '../brevo/email-blocks';
import { DailyClose } from '../market-data/price-history';
import { AllocationRow, DriftRow, Position, RebalancePlan, SectorRow } from './rebalance';

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;
const signedKes = (n: number) => `${n >= 0 ? '+' : '-'}KSh ${Math.abs(Math.round(n)).toLocaleString('en-KE')}`;
const pct1 = (n: number) => `${n.toFixed(1)}%`;

const EAT_MS = 3 * 3_600_000;

/** The quarter that has just ended, as of `now` in Nairobi: Jan-Mar 2027 -> "2026-Q4". The dedupe key and the label. */
export function previousQuarter(now: Date): { key: string; label: string; dayOfMonth: number; month: number } {
  const eat = new Date(now.getTime() + EAT_MS);
  const y = eat.getUTCFullYear();
  const m = eat.getUTCMonth(); // 0-11
  const q = Math.floor(m / 3) + 1; // current quarter
  const py = q === 1 ? y - 1 : y;
  const pq = q === 1 ? 4 : q - 1;
  return { key: `${py}-Q${pq}`, label: `Q${pq} ${py}`, dayOfMonth: eat.getUTCDate(), month: m + 1 };
}

export interface PeriodPerformance {
  changeKes: number;
  changePct: number | null;
  /** Per stock, over the same window. Stocks without enough history are left out. */
  perStock: { ticker: string; pct: number }[];
  days: number;
}

/**
 * What the shares held today did over the last `days` days. Deliberately "the shares you hold today": it ignores
 * trades made in the period, which would need the full trade history to get right, and the email says so.
 */
export function periodPerformance(positions: Position[], series: Map<string, DailyClose[]>, asOfYmd: string, days = 90): PeriodPerformance | null {
  const start = new Date(Date.parse(`${asOfYmd}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  let now = 0;
  let then = 0;
  const perStock: { ticker: string; pct: number }[] = [];
  for (const p of positions) {
    const closes = (series.get(p.ticker) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (closes.length < 2) continue;
    const first = closes.find((c) => c.date >= start);
    const last = closes[closes.length - 1];
    // Needs a close within a week of the window start, or the number would describe a shorter period than it claims.
    if (!first || first.price <= 0 || Date.parse(first.date) - Date.parse(start) > 7 * 86_400_000) continue;
    now += p.quantity * last.price;
    then += p.quantity * first.price;
    perStock.push({ ticker: p.ticker, pct: ((last.price - first.price) / first.price) * 100 });
  }
  if (then <= 0) return null;
  perStock.sort((a, b) => b.pct - a.pct);
  return { changeKes: now - then, changePct: ((now - then) / then) * 100, perStock, days };
}

export interface ReviewInput {
  firstName: string;
  periodLabel: string;
  asOfLabel: string;
  siteUrl: string;
  valueKes: number;
  performance: PeriodPerformance | null;
  rows: AllocationRow[];
  sectors: SectorRow[];
  notes: string[];
  drift: DriftRow[] | null;
  plan: RebalancePlan | null;
}

const MAX_ROWS = 8;

export function renderReview(i: ReviewInput): { subject: string; html: string; text: string } {
  const first = (i.firstName || '').trim().split(/\s+/)[0] || 'there';
  const link = `${i.siteUrl}/dashboard/journal/allocation`;
  const driftBy = new Map((i.drift ?? []).map((d) => [d.ticker, d]));
  const hasTargets = (i.drift?.length ?? 0) > 0;
  const subject = `Your ${i.periodLabel} portfolio review`;

  const stats = [{ label: 'Portfolio value', value: kes(i.valueKes) }];
  if (i.performance && i.performance.changePct != null) {
    stats.push({ label: `Last ${i.performance.days} days`, value: `${signedKes(i.performance.changeKes)} (${i.performance.changePct >= 0 ? '+' : ''}${i.performance.changePct.toFixed(1)}%)` });
  }

  const cols = hasTargets
    ? [{ header: 'Stock' }, { header: 'Weight', align: 'right' as const }, { header: 'Target', align: 'right' as const }, { header: 'Off by', align: 'right' as const }]
    : [{ header: 'Stock' }, { header: 'Sector' }, { header: 'Weight', align: 'right' as const }];
  const tableRows = i.rows.slice(0, MAX_ROWS).map((r) => {
    const d = driftBy.get(r.ticker);
    return hasTargets
      ? [`<strong>${escapeHtml(r.ticker)}</strong>`, pct1(r.weightPct), d ? pct1(d.targetPct) : '-', d ? `${d.driftPct >= 0 ? '+' : ''}${d.driftPct.toFixed(1)} pts` : '-']
      : [`<strong>${escapeHtml(r.ticker)}</strong>`, escapeHtml(r.sector ?? '-'), pct1(r.weightPct)];
  });

  const parts: string[] = [statRows(stats)];
  if (i.performance && i.performance.perStock.length >= 2) {
    const best = i.performance.perStock[0];
    const worst = i.performance.perStock[i.performance.perStock.length - 1];
    parts.push(`<p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#18181b;">Best over the period: <strong>${escapeHtml(best.ticker)}</strong> ${signedPct(best.pct)}. Weakest: <strong>${escapeHtml(worst.ticker)}</strong> ${signedPct(worst.pct)}. This looks at the shares you hold today, so it ignores any you bought or sold during the period.</p>`);
  }
  parts.push(sectionHeading('Where your money is'), dataTable(cols, tableRows));
  if (i.rows.length > MAX_ROWS) parts.push(`<p style="margin:8px 0 0;font-size:12px;color:#52525b;">Showing the ${MAX_ROWS} biggest of ${i.rows.length} holdings.</p>`);
  if (i.notes.length) parts.push(`<ul style="margin:14px 0 0;padding-left:18px;">${i.notes.map((n) => `<li style="margin:0 0 8px;font-size:14px;line-height:1.55;color:#18181b;">${escapeHtml(n)}</li>`).join('')}</ul>`);

  if (i.plan) {
    parts.push(sectionHeading('Getting back to your targets', 'your weights, your call'));
    if (i.plan.trades.length === 0) {
      parts.push(`<p style="margin:0;font-size:14px;line-height:1.55;color:#18181b;">Every stock is within 2 percentage points of its target, so nothing needs to change.</p>`);
    } else {
      parts.push(
        dataTable(
          [{ header: 'Action' }, { header: 'Stock' }, { header: 'Shares', align: 'right' }, { header: 'Value', align: 'right' }, { header: 'Fee', align: 'right' }],
          i.plan.trades.map((t) => [t.action === 'SELL' ? 'Sell' : 'Buy', `<strong>${escapeHtml(t.ticker)}</strong>`, t.shares.toLocaleString('en-KE'), kes(t.valueKes), t.feeKes != null ? kes(t.feeKes) : '-']),
        ),
        `<p style="margin:10px 0 0;font-size:14px;line-height:1.55;color:#18181b;">Broker fees would total about <strong>${kes(i.plan.totalFeesKes)}</strong> (${i.plan.feesPctOfBase.toFixed(1)}% of the portfolio).</p>`,
      );
    }
    if (i.plan.warnings.length) parts.push(`<ul style="margin:10px 0 0;padding-left:18px;">${i.plan.warnings.map((w) => `<li style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#52525b;">${escapeHtml(w)}</li>`).join('')}</ul>`);
  } else {
    parts.push(sectionHeading('Set your targets'), `<p style="margin:0;font-size:14px;line-height:1.55;color:#18181b;">Tell us what share of your portfolio you want each stock to be, and the next review will show how far you have drifted and what it would take to get back, with your broker's fees. <a href="${link}" style="color:#047857;font-weight:700;">Set your targets</a>.</p>`);
  }

  const foot = 'Educational content only, not investment advice. Weights use last-close prices on ' + i.asOfLabel + '. Targets are the ones you set; we do not choose them for you. Past performance does not predict future results.';
  const html = renderEmailHtml({
    eyebrow: `Quarterly review - ${i.periodLabel}`,
    heading: `Your ${i.periodLabel} portfolio review`,
    bodyHtml: [`Hi ${escapeHtml(first)}, here is where your NSE portfolio stands after ${escapeHtml(i.periodLabel)}.`],
    rawHtml: parts.join('\n'),
    button: { label: 'Open your allocation', url: link },
    footNoteHtml: escapeHtml(foot),
    siteUrl: i.siteUrl,
  });
  const text = renderEmailText({
    heading: `Your ${i.periodLabel} portfolio review`,
    bodyText: [
      `Hi ${first}, here is where your NSE portfolio stands after ${i.periodLabel}.`,
      `Portfolio value: ${kes(i.valueKes)}.`,
      i.performance && i.performance.changePct != null ? `Last ${i.performance.days} days: ${signedKes(i.performance.changeKes)} (${i.performance.changePct.toFixed(1)}%).` : '',
      `Biggest holdings: ${i.rows.slice(0, 5).map((r) => `${r.ticker} ${pct1(r.weightPct)}`).join(', ')}.`,
      ...i.notes,
      i.plan ? (i.plan.trades.length ? `To reach your targets: ${i.plan.trades.map((t) => `${t.action === 'SELL' ? 'sell' : 'buy'} ${t.shares} ${t.ticker}`).join(', ')}. Fees about ${kes(i.plan.totalFeesKes)}.` : 'You are within 2 percentage points of every target.') : 'Set your target weights to see how far you have drifted.',
      foot,
    ].filter(Boolean),
    button: { label: 'Open your allocation', url: link },
    siteUrl: i.siteUrl,
  });
  return { subject, html, text };
}

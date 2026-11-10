// The evening market digest: the day's public market report in a member's inbox, with the day's move in their own
// holdings when they have any. Pure (no database, clock or network) so the same code drives the send and the tests.

import { createHmac, timingSafeEqual } from 'crypto';
import { escapeHtml, renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { dataTable, sectionHeading, signedPct, statRows } from '../brevo/email-blocks';
import { DailyClose } from '../market-data/price-history';
import { MarketFacts } from './market-facts';

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;
const signedKes = (n: number) => `${n >= 0 ? '+' : '-'}KSh ${Math.abs(Math.round(n)).toLocaleString('en-KE')}`;
const plainPct = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}%`;
const px = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactKes = (n: number) => (n >= 1e9 ? `KSh ${+(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `KSh ${+(n / 1e6).toFixed(1)}M` : kes(n));

export interface DigestReport {
  sessionYmd: string;
  shortLabel: string;
  headline: string;
  summary: string;
  url: string;
  facts: Pick<MarketFacts, 'breadth' | 'valueTradedKes' | 'avgValueTradedKes' | 'valueVsAvgPct' | 'gainers' | 'losers'>;
}

export interface DigestHolding {
  ticker: string;
  quantity: number;
  price: number;
  /** null when the stock did not trade that day or has no previous close. */
  dayChangePct: number | null;
  valueKes: number;
}

export interface DigestPortfolio {
  valueKes: number;
  dayChangeKes: number;
  dayChangePct: number | null;
  /** Biggest movers first, then the rest by value. */
  holdings: DigestHolding[];
}

/** A member's holdings priced at the session's closes. Stocks that did not trade on `sessionYmd` show no move. */
export function buildDigestPortfolio(positions: { ticker: string; quantity: number }[], series: Map<string, DailyClose[]>, sessionYmd: string): DigestPortfolio | null {
  const merged = new Map<string, number>();
  for (const p of positions) if (p.quantity > 0) merged.set(p.ticker, (merged.get(p.ticker) ?? 0) + p.quantity);

  const holdings: DigestHolding[] = [];
  let value = 0;
  let change = 0;
  let prevValue = 0;
  for (const [ticker, quantity] of merged) {
    const closes = (series.get(ticker) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (closes.length === 0) continue;
    const last = closes[closes.length - 1];
    const prev = closes.length > 1 ? closes[closes.length - 2] : null;
    const traded = last.date === sessionYmd && prev != null && prev.price > 0;
    const dayChangePct = traded ? ((last.price - (prev as DailyClose).price) / (prev as DailyClose).price) * 100 : null;
    const valueKes = quantity * last.price;
    value += valueKes;
    if (traded) {
      change += quantity * (last.price - (prev as DailyClose).price);
      prevValue += quantity * (prev as DailyClose).price;
    } else {
      prevValue += valueKes;
    }
    holdings.push({ ticker, quantity, price: last.price, dayChangePct, valueKes });
  }
  if (holdings.length === 0) return null;
  holdings.sort((a, b) => Math.abs(b.dayChangePct ?? 0) - Math.abs(a.dayChangePct ?? 0) || b.valueKes - a.valueKes);
  return { valueKes: value, dayChangeKes: change, dayChangePct: prevValue > 0 ? (change / prevValue) * 100 : null, holdings };
}

export interface DigestInput {
  firstName: string;
  report: DigestReport;
  portfolio: DigestPortfolio | null;
  isPremium: boolean;
  siteUrl: string;
  unsubscribeUrl: string;
  manageUrl: string;
}

const MAX_HOLDING_ROWS = 6;
const MOVER_ROWS = 3;

export function renderDigest(i: DigestInput): { subject: string; html: string; text: string } {
  const { report, portfolio } = i;
  const f = report.facts;
  const first = (i.firstName || '').trim().split(/\s+/)[0] || 'there';

  const subject = portfolio && portfolio.dayChangePct != null
    ? `NSE ${report.shortLabel}: ${f.breadth.advancers} up, ${f.breadth.decliners} down. Your portfolio ${plainPct(portfolio.dayChangePct)}`
    : `NSE ${report.shortLabel}: ${f.breadth.advancers} up, ${f.breadth.decliners} down, ${compactKes(f.valueTradedKes)} traded`;

  const marketStats = [
    { label: 'Advancers / decliners', value: `${f.breadth.advancers} / ${f.breadth.decliners}`, note: `${f.breadth.unchanged} unchanged` },
    {
      label: 'Value traded',
      value: compactKes(f.valueTradedKes),
      note: f.valueVsAvgPct != null && f.avgValueTradedKes != null ? `${Math.abs(Math.round(f.valueVsAvgPct))}% ${f.valueVsAvgPct >= 0 ? 'above' : 'below'} its recent average` : undefined,
    },
  ];
  const moverRows = (list: DigestReport['facts']['gainers']) => list.slice(0, MOVER_ROWS).map((m) => [`<strong>${escapeHtml(m.ticker)}</strong>`, px(m.price), signedPct(m.changePct)]);
  const moverCols = [{ header: 'Stock' }, { header: 'Close', align: 'right' as const }, { header: 'Change', align: 'right' as const }];

  const parts: string[] = [];
  if (portfolio) {
    const pct = portfolio.dayChangePct;
    parts.push(
      sectionHeading('Your portfolio today'),
      statRows([
        { label: 'Value at the close', value: kes(portfolio.valueKes) },
        { label: 'Today', value: pct != null ? `${signedKes(portfolio.dayChangeKes)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)` : signedKes(portfolio.dayChangeKes) },
      ]),
      dataTable(
        [{ header: 'Stock' }, { header: 'Shares', align: 'right' }, { header: 'Close', align: 'right' }, { header: 'Today', align: 'right' }],
        portfolio.holdings.slice(0, MAX_HOLDING_ROWS).map((h) => [`<strong>${escapeHtml(h.ticker)}</strong>`, h.quantity.toLocaleString('en-KE'), px(h.price), h.dayChangePct != null ? signedPct(h.dayChangePct) : 'no trade']),
      ),
    );
    if (portfolio.holdings.length > MAX_HOLDING_ROWS) parts.push(`<p style="margin:8px 0 0;font-size:12px;color:#52525b;">Showing the ${MAX_HOLDING_ROWS} biggest movers of ${portfolio.holdings.length} holdings.</p>`);
    if (!i.isPremium) {
      parts.push(`<p style="margin:14px 0 0;font-size:14px;line-height:1.55;color:#18181b;">Premium members also get Portfolio Watch at 16:30 every trading day: flags for big moves, stocks near a 60-day high or low, and positions that have grown too large. <a href="${i.siteUrl}/pricing#portfolio-watch" style="color:#047857;font-weight:700;">See an example</a>.</p>`);
    }
  }
  parts.push(
    sectionHeading('The market', report.shortLabel),
    statRows(marketStats),
    sectionHeading('Biggest risers'),
    dataTable(moverCols, moverRows(f.gainers)),
    sectionHeading('Biggest fallers'),
    dataTable(moverCols, moverRows(f.losers)),
  );

  const foot = `Educational content only, not investment advice. Prices are NSE closing prices for ${report.shortLabel}. You get this because you turned on the evening digest. <a href="${i.manageUrl}" style="color:#047857;">Manage it</a> or <a href="${i.unsubscribeUrl}" style="color:#047857;">stop it in one click</a>.`;

  const html = renderEmailHtml({
    eyebrow: `Evening digest - ${report.shortLabel}`,
    heading: report.headline,
    bodyHtml: [`Hi ${escapeHtml(first)}, ${escapeHtml(report.summary)}`],
    rawHtml: parts.join('\n'),
    button: { label: 'Read the full report', url: report.url },
    footNoteHtml: foot,
    siteUrl: i.siteUrl,
  });

  const text = renderEmailText({
    heading: report.headline,
    bodyText: [
      `Hi ${first}, ${report.summary}`,
      portfolio ? `Your portfolio: ${kes(portfolio.valueKes)}${portfolio.dayChangePct != null ? `, ${portfolio.dayChangePct >= 0 ? '+' : ''}${portfolio.dayChangePct.toFixed(2)}% today` : ''}.` : '',
      `Risers: ${f.gainers.slice(0, MOVER_ROWS).map((m) => `${m.ticker} ${m.changePct >= 0 ? '+' : ''}${m.changePct.toFixed(2)}%`).join(', ')}.`,
      `Fallers: ${f.losers.slice(0, MOVER_ROWS).map((m) => `${m.ticker} ${m.changePct.toFixed(2)}%`).join(', ')}.`,
      `Educational content only, not investment advice. Stop this email: ${i.unsubscribeUrl}`,
    ].filter(Boolean),
    button: { label: 'Read the full report', url: report.url },
    siteUrl: i.siteUrl,
  });
  return { subject, html, text };
}

// ---- one-click unsubscribe: a link that carries its own proof, so it works from any mail client without signing in

const tokenFor = (userId: string, secret: string) => createHmac('sha256', secret).update(`digest:${userId}`).digest('hex').slice(0, 32);

export function digestToken(userId: string, secret: string): string {
  return tokenFor(userId, secret);
}

export function verifyDigestToken(userId: string, token: string, secret: string): boolean {
  if (!userId || typeof token !== 'string' || token.length !== 32) return false;
  const a = Buffer.from(tokenFor(userId, secret));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

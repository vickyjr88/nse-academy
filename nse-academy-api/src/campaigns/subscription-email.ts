// The "why subscribe / renew" marketing email. Pure: everything it needs (the example portfolio watch, the
// site URL, the unsubscribe link) is passed in, so the same builder produces the Brevo campaign, the sample sent
// for review, and the tests.
//
// Every claim here is something the product actually does today - the plan matrix mirrors the tier gates in the
// API (RequireTier on the journal, alerts and portfolio watch; the Premium-only advisor page) and the prices and
// discounts come from the payment code's own constants, so they cannot drift from what Paystack charges.

import { escapeHtml, renderEmailHtml, renderEmailText } from '../brevo/email-template';
import { dataTable, sectionHeading, signedPct, statRows } from '../brevo/email-blocks';
import { BillingMonths, DISCOUNT_BY_MONTHS, PLAN_PRICES, SubscriptionPlan, VALID_MONTHS, computeAmountKobo } from '../payments/payments.service';
import { WatchHolding, WatchItem, WatchResult } from '../portfolio-watch/portfolio-watch';

export type Audience = 'free' | 'intermediary' | 'premium';

export interface ExampleWatch {
  /** Nairobi date of the closing prices used, YYYY-MM-DD. */
  asOf: string;
  /** e.g. "Thursday 5 November 2026". */
  asOfLabel: string;
  result: WatchResult;
  /** The handful of observations worth showing, already ordered. */
  items: WatchItem[];
}

export interface BuildInput {
  audience: Audience;
  siteUrl: string;
  example: ExampleWatch | null;
  /** Brevo campaigns pass its merge tag; a sample passes a placeholder. */
  unsubscribeUrl: string;
  /** True for the review copy: adds a banner and does not pretend the unsubscribe link works. */
  sample?: boolean;
}

const TEXT = '#18181b';
const MUTED = '#52525b';
const BORDER = '#e4e4e7';
const BRAND = '#047857';
const SOFT = '#ecfdf5';

const kes = (n: number) => `KSh ${Math.round(n).toLocaleString('en-KE')}`;
const signedKes = (n: number) => `${n >= 0 ? '+' : '-'}KSh ${Math.abs(Math.round(n)).toLocaleString('en-KE')}`;
const px = (n: number) => n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const planKes = (plan: SubscriptionPlan, months: BillingMonths) => computeAmountKobo(plan, months) / 100;

const COPY: Record<Audience, { subject: string; eyebrow: string; heading: string; intro: string[]; cta: { label: string; path: string } }> = {
  free: {
    subject: 'Know what deserves a look after every NSE close - from KSh 300/month',
    eyebrow: 'NSE Academy plans',
    heading: 'Your NSE portfolio, watched for you',
    intro: [
      "Investing on the Nairobi Securities Exchange shouldn't mean checking prices all evening. With an NSE Academy subscription, we watch your holdings after every close and tell you what deserves a look.",
      "If you've never subscribed, this is what a plan adds. If yours lapsed, this is what has been added since.",
    ],
    cta: { label: 'Choose your plan', path: '/dashboard/billing' },
  },
  intermediary: {
    subject: 'Renew your NSE Academy plan - and see what Premium adds',
    eyebrow: 'Your NSE Academy plan',
    heading: 'Get more from your NSE Academy plan',
    intro: [
      'You already have the trade journal, portfolio tracking and price alerts. Premium adds the part that does the watching for you: a daily Portfolio Watch on your own holdings and a personalised stock advisor backed by current news.',
      'You can extend any time: the new months are added after your current end date, so you lose no days, and paying for 3, 6 or 12 months at once saves 5%, 10% or 15%.',
    ],
    cta: { label: 'See Premium and renewal options', path: '/dashboard/billing' },
  },
  premium: {
    subject: 'Everything in your NSE Academy Premium plan',
    eyebrow: 'Your NSE Academy Premium plan',
    heading: 'Make the most of your Premium plan',
    intro: [
      'Premium is the full toolkit, and a few minutes of setup make the daily Portfolio Watch much sharper. Here is what it looks like, and how to get the best from it.',
      'You can extend your plan any time too: the new months are added after your current end date, so you lose no days, and paying for 3, 6 or 12 months at once saves 5%, 10% or 15%.',
    ],
    cta: { label: 'Extend your Premium plan', path: '/dashboard/billing' },
  },
};

/** The subject line for an audience, without building the whole email. */
export const subscriptionSubject = (audience: Audience): string => COPY[audience].subject;

const MATRIX: { feature: string; free: boolean; intermediary: boolean; premium: boolean }[] = [
  { feature: 'Investor profiler quiz, NSE glossary, daily market report, calculators', free: true, intermediary: true, premium: true },
  { feature: 'First 3 course modules', free: true, intermediary: true, premium: true },
  { feature: 'NSE Complete Trading Guide course and PDF', free: false, intermediary: true, premium: true },
  { feature: 'All 62 NSE companies deep dive, market indices and strategies', free: false, intermediary: true, premium: true },
  { feature: 'Stockbroker comparison module', free: false, intermediary: true, premium: true },
  { feature: 'Trade journal, portfolio and performance tracking, CDSC statement import, dividend tracking', free: false, intermediary: true, premium: true },
  { feature: 'Price alerts', free: false, intermediary: true, premium: true },
  { feature: "Full 13-chapter Investor's Guide academy and PDF (worth KSh 999)", free: false, intermediary: false, premium: true },
  { feature: 'Personalised AI stock advisor: fit for your investor type, backed by current news', free: false, intermediary: false, premium: true },
  { feature: 'Portfolio Watch: a daily check on your own holdings', free: false, intermediary: false, premium: true },
  { feature: 'Priority support', free: false, intermediary: false, premium: true },
];

function paragraph(html: string, style = ''): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT};${style}">${html}</p>`;
}

function tick(on: boolean): string {
  return on
    ? `<span style="color:${BRAND};font-weight:700;font-size:16px;">&#10003;</span>`
    : `<span style="color:#a1a1aa;">&ndash;</span>`;
}

function planMatrix(highlight: Audience | null): string {
  const cols: { key: Audience; name: string; price: string }[] = [
    { key: 'free', name: 'Free', price: 'KSh 0' },
    { key: 'intermediary', name: 'Intermediary', price: `${kes(PLAN_PRICES.intermediary / 100)}/mo` },
    { key: 'premium', name: 'Premium', price: `${kes(PLAN_PRICES.premium / 100)}/mo` },
  ];
  const cell = (key: Audience, inner: string, extra = '') =>
    `<td align="center" width="80" style="padding:9px 4px;border-bottom:1px solid ${BORDER};text-align:center;${highlight === key ? `background:${SOFT};` : ''}${extra}">${inner}</td>`;
  const head = cols
    .map(
      (c) =>
        `<th align="center" width="80" style="padding:8px 4px;font-size:11px;line-height:1.3;color:${TEXT};text-align:center;border-bottom:2px solid ${BORDER};${highlight === c.key ? `background:${SOFT};` : ''}">${c.name}<br><span style="font-weight:400;color:${MUTED};white-space:nowrap;">${c.price}</span></th>`,
    )
    .join('');
  const rows = MATRIX.map(
    (r) =>
      `<tr><td style="padding:9px 8px 9px 0;font-size:13px;line-height:1.45;color:${TEXT};border-bottom:1px solid ${BORDER};">${escapeHtml(r.feature)}</td>${cell('free', tick(r.free))}${cell('intermediary', tick(r.intermediary))}${cell('premium', tick(r.premium))}</tr>`,
  ).join('\n');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-collapse:collapse;">
  <tr><th align="left" style="padding:8px 8px 8px 0;font-size:11px;color:${MUTED};border-bottom:2px solid ${BORDER};text-align:left;">What you get</th>${head}</tr>
  ${rows}
</table>`;
}

function discountTable(): string {
  const label = (m: BillingMonths) => (m === 1 ? '1 month' : `${m} months`) + (DISCOUNT_BY_MONTHS[m] ? ` (${Math.round(DISCOUNT_BY_MONTHS[m] * 100)}% off)` : '');
  const rows = VALID_MONTHS.map((m) => [
    escapeHtml(label(m)),
    `${kes(planKes('intermediary', m))}${m > 1 ? `<br><span style="font-size:12px;color:${MUTED};">${kes(planKes('intermediary', m) / m)} a month</span>` : ''}`,
    `${kes(planKes('premium', m))}${m > 1 ? `<br><span style="font-size:12px;color:${MUTED};">${kes(planKes('premium', m) / m)} a month</span>` : ''}`,
  ]);
  return dataTable([{ header: 'Pay for' }, { header: 'Intermediary', align: 'right' }, { header: 'Premium', align: 'right' }], rows);
}

function holdingsTable(holdings: WatchHolding[]): string {
  return dataTable(
    [
      { header: 'Stock' },
      { header: 'Shares', align: 'right' },
      { header: 'Price', align: 'right' },
      { header: 'Today', align: 'right' },
      { header: 'On cost', align: 'right' },
    ],
    holdings.map((h) => [
      `<strong>${escapeHtml(h.ticker)}</strong>`,
      h.quantity.toLocaleString('en-KE'),
      px(h.price),
      h.dayChangePct != null ? signedPct(h.dayChangePct) : '-',
      h.gainPct != null ? signedPct(h.gainPct) : '-',
    ]),
  );
}

function exampleBlock(ex: ExampleWatch, planUrl: string): string {
  const r = ex.result;
  const stats = [
    { label: 'Portfolio value', value: kes(r.valueKes) },
    { label: 'Today', value: r.dayChangePct != null ? `${signedKes(r.dayChangeKes)} (${r.dayChangePct >= 0 ? '+' : ''}${r.dayChangePct.toFixed(2)}%)` : signedKes(r.dayChangeKes) },
  ];
  if (r.unrealizedKes != null && r.unrealizedPct != null) {
    stats.push({ label: 'Gain on cost', value: `${signedKes(r.unrealizedKes)} (${r.unrealizedPct >= 0 ? '+' : ''}${r.unrealizedPct.toFixed(1)}%)` });
  }
  const list = ex.items.map((i) => `<li style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${TEXT};">${escapeHtml(i.text)}</li>`).join('');
  return [
    sectionHeading('Portfolio Watch', 'an example, five stocks'),
    paragraph(`Every trading day after the close, Premium members get a short email like this about <em>their own</em> holdings. Here is one for an example portfolio, on the real NSE closing prices of ${escapeHtml(ex.asOfLabel)}.`),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:#fafafa;border:1px solid ${BORDER};border-radius:12px;padding:18px 20px;">
      ${statRows(stats)}
      <p style="margin:14px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${TEXT};">Worth a look</p>
      <ul style="margin:0 0 16px;padding-left:18px;">${list}</ul>
      ${holdingsTable(r.holdings)}
      <p style="margin:10px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">Illustrative: the shares and costs are made up for this example. The prices and the way each flag is worked out are real. Information only, not investment advice.</p>
    </td></tr></table>`,
    paragraph('It flags big moves, profit and loss against your cost, stocks near a 60-day high or low, and over-concentration, and stays quiet when there is nothing worth saying.', `color:${MUTED};font-size:14px;`),
    paragraph(`<a href="${planUrl}" style="color:${BRAND};font-weight:700;">See which plan includes it &rarr;</a>`, 'font-size:14px;'),
  ].join('\n');
}

function premiumSteps(portfolioUrl: string): string {
  const step = (n: number, t: string) =>
    `<tr><td width="30" valign="top" style="padding:6px 0;font-size:14px;font-weight:700;color:${BRAND};">${n}.</td><td style="padding:6px 0;font-size:14px;line-height:1.55;color:${TEXT};">${t}</td></tr>`;
  return [
    sectionHeading('Three minutes to a sharper Portfolio Watch'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
      ${step(1, 'Import your CDSC statement or log your trades in the trade journal, so we know what you hold.')}
      ${step(2, 'Enter the price you actually paid for each stock on the Performance page. Until you do, gains are measured from the day you imported.')}
      ${step(3, 'Keep the daily email on, and open the Research page for a news-backed view on any NSE stock.')}
    </table>`,
    paragraph(`<a href="${portfolioUrl}" style="color:${BRAND};font-weight:700;">Open your portfolio &rarr;</a>`, 'font-size:14px;'),
  ].join('\n');
}

export function buildSubscriptionEmail(input: BuildInput): { subject: string; html: string; text: string } {
  const copy = COPY[input.audience];
  const site = input.siteUrl.replace(/\/$/, '');
  const ctaUrl = `${site}${copy.cta.path}`;

  const parts: string[] = [];
  if (input.sample) {
    parts.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.5;color:#78350f;"><strong>SAMPLE FOR REVIEW</strong> - ${escapeHtml(input.audience)} audience. The real send goes through a Brevo campaign with a working unsubscribe link, and is not sent until you approve it.</td></tr></table>`,
    );
  }
  if (input.example) parts.push(exampleBlock(input.example, ctaUrl));
  if (input.audience === 'premium') parts.push(premiumSteps(`${site}/dashboard/journal/performance`));

  parts.push(sectionHeading('What each plan includes'));
  parts.push(planMatrix(input.audience === 'free' ? 'intermediary' : input.audience === 'intermediary' ? 'premium' : 'premium'));

  parts.push(sectionHeading('Pay for longer, pay less', 'prepaid terms'));
  parts.push(discountTable());

  parts.push(sectionHeading('Bring a friend, get a free month'));
  parts.push(paragraph('Share your referral link from the Referrals page. When a friend subscribes, you each get one month free.', 'font-size:14px;'));

  const unsubscribe = input.sample
    ? '<span style="text-decoration:underline;">Unsubscribe</span> (a working link is added to the real send)'
    : `<a href="${input.unsubscribeUrl}" style="color:${MUTED};">Unsubscribe</a>`;
  const foot = [
    'Pay by M-Pesa or card (Paystack). Cancel anytime.',
    'Share prices are for information only and delayed. Everything on NSE Academy is educational and is not investment advice; shares can fall as well as rise.',
    `You are receiving this because you have an NSE Academy account. ${unsubscribe}`,
  ]
    .map((l) => `<span style="display:block;margin:0 0 6px;">${l}</span>`)
    .join('');

  const html = renderEmailHtml({
    eyebrow: copy.eyebrow,
    heading: copy.heading,
    bodyHtml: copy.intro.map((p) => escapeHtml(p)),
    rawHtml: parts.join('\n'),
    button: { label: copy.cta.label, url: ctaUrl },
    footNoteHtml: foot,
    siteUrl: site,
  });

  const textLines: string[] = [...copy.intro];
  if (input.example) {
    textLines.push(
      `Portfolio Watch - an example (illustrative holdings, real NSE closes of ${input.example.asOfLabel}):`,
      ...input.example.items.map((i) => `- ${i.text}`),
    );
  }
  textLines.push(
    'Free: investor quiz, glossary, daily market report, calculators, first 3 course modules.',
    `Intermediary (${kes(PLAN_PRICES.intermediary / 100)}/month): full courses and PDF, 62 companies deep dive, broker comparison, trade journal and portfolio tracking, dividend tracking, price alerts.`,
    `Premium (${kes(PLAN_PRICES.premium / 100)}/month): everything above plus the 13-chapter Investor's Guide academy and PDF, personalised AI stock advisor, daily Portfolio Watch, priority support.`,
  );
  textLines.push('Pay for 3, 6 or 12 months at once and save 5%, 10% or 15%.');
  textLines.push('Refer a friend who subscribes and you each get a free month.', 'Pay by M-Pesa or card. Cancel anytime. Information only, not investment advice.');
  if (!input.sample) textLines.push(`Unsubscribe: ${input.unsubscribeUrl}`);

  const text = renderEmailText({ heading: copy.heading, bodyText: textLines, button: { label: copy.cta.label, url: ctaUrl }, siteUrl: site });
  return { subject: copy.subject, html, text };
}

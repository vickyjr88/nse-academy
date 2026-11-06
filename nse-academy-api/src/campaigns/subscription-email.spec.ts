import { Audience, buildSubscriptionEmail } from './subscription-email';
import { buildExampleWatch } from './example-watch';
import { exampleSeries } from './example-series.fixtures';

const example = buildExampleWatch(exampleSeries());
const build = (audience: Audience, over: Partial<Parameters<typeof buildSubscriptionEmail>[0]> = {}) =>
  buildSubscriptionEmail({ audience, siteUrl: 'https://nseacademy.example', example, unsubscribeUrl: '{{ unsubscribe }}', ...over });

describe('buildSubscriptionEmail', () => {
  it('gives each audience its own subject, heading and call to action', () => {
    const free = build('free');
    const mid = build('intermediary');
    const prem = build('premium');
    expect(new Set([free.subject, mid.subject, prem.subject]).size).toBe(3);
    expect(free.html).toContain('Your NSE portfolio, watched for you');
    expect(mid.html).toContain('Get more from your NSE Academy plan');
    expect(prem.html).toContain('Make the most of your Premium plan');
    expect(free.html).toContain('href="https://nseacademy.example/dashboard/billing"');
    expect(prem.html).toContain('Extend your Premium plan');
  });

  it('shows the five example stocks, the real flags, and says plainly the holdings are illustrative', () => {
    const { html, text } = build('free');
    for (const t of ['NSE', 'KEGN', 'UCHM', 'KPLC', 'NBV']) expect(html).toContain(`<strong>${t}</strong>`);
    expect(html).toContain('NSE is up 24');
    expect(html).toContain('Thursday 5 November 2026');
    expect(html).toContain('Illustrative');
    expect(html).toContain('Information only, not investment advice');
    expect(text).toContain('Portfolio Watch - an example');
  });

  it('never presents the example as anyone\'s actual portfolio', () => {
    const { html } = build('free');
    expect(html).not.toMatch(/\byour (own )?portfolio is\b/i);
    expect(html).toMatch(/example portfolio/i);
  });

  it('prices every plan and term from the payment code, so it cannot disagree with what is charged', () => {
    const { html } = build('free');
    expect(html).toContain('KSh 300/mo');
    expect(html).toContain('KSh 500/mo');
    expect(html).toContain('KSh 855'); // Intermediary, 3 months, 5% off
    expect(html).toContain('KSh 1,620'); // Intermediary, 6 months, 10% off
    expect(html).toContain('KSh 3,060'); // Intermediary, 12 months, 15% off
    expect(html).toContain('KSh 5,100'); // Premium, 12 months
    expect(html).toContain('KSh 425 a month');
  });

  it('lists the paid features under the plans that really include them', () => {
    const { html } = build('free');
    const row = (label: string) => {
      const m = new RegExp(`${label}[\\s\\S]*?</tr>`).exec(html)!;
      return [...m[0].matchAll(/&#10003;|&ndash;/g)].map((x) => (x[0] === '&#10003;' ? 1 : 0));
    };
    expect(row('Price alerts')).toEqual([0, 1, 1]);
    expect(row('Portfolio Watch: a daily check')).toEqual([0, 0, 1]);
    expect(row('Personalised AI stock advisor')).toEqual([0, 0, 1]);
    expect(row('First 3 course modules')).toEqual([1, 1, 1]);
  });

  it('tells every paid member they can extend early without losing days, and shows the prepaid savings to all three audiences', () => {
    for (const a of ['free', 'intermediary', 'premium'] as Audience[]) expect(build(a).html).toContain('Pay for longer, pay less');
    for (const a of ['intermediary', 'premium'] as Audience[]) {
      const { html, text } = build(a);
      expect(html).toContain('the new months are added after your current end date');
      expect(text).toContain('save 5%, 10% or 15%');
    }
    const prem = build('premium');
    expect(prem.html).toContain('Three minutes to a sharper Portfolio Watch');
    expect(prem.html).toContain('Extend your Premium plan');
    expect(prem.html).toContain('href="https://nseacademy.example/dashboard/billing"');
    expect(prem.html).toContain('href="https://nseacademy.example/dashboard/journal/performance"'); // the setup link
  });

  it('mentions the referral month, payment methods and cancellation', () => {
    const { html } = build('intermediary');
    expect(html).toContain('you each get one month free');
    expect(html).toContain('M-Pesa or card');
    expect(html).toContain('Cancel anytime');
  });

  it('puts Brevo\'s unsubscribe link in the real send and a clearly inert one, plus a banner, in the sample', () => {
    const real = build('free');
    expect(real.html).toContain('href="{{ unsubscribe }}"');
    expect(real.html).not.toContain('SAMPLE FOR REVIEW');
    expect(real.text).toContain('Unsubscribe: {{ unsubscribe }}');
    const sample = build('free', { sample: true });
    expect(sample.html).not.toContain('{{ unsubscribe }}');
    expect(sample.html).toContain('SAMPLE FOR REVIEW');
  });

  it('still builds, without the example block, when there is no price data', () => {
    const { html } = build('free', { example: null });
    expect(html).not.toContain('Portfolio Watch</td>');
    expect(html).toContain('What each plan includes');
  });

  it('escapes anything that is not fixed copy', () => {
    const ex = { ...example!, items: [{ ...example!.items[0], text: '<script>alert(1)</script> is up' }] };
    const { html } = build('free', { example: ex });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('makes no promises it cannot keep', () => {
    for (const a of ['free', 'intermediary', 'premium'] as Audience[]) {
      const { html } = build(a);
      expect(html).not.toMatch(/guarantee|risk[- ]free|make money|profit(s)? (is|are) certain/i);
    }
  });
});

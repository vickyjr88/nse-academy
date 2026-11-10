import { DigestReport, buildDigestPortfolio, digestToken, renderDigest, verifyDigestToken } from './digest';
import { MarketDigestService } from './market-digest.service';

const report: DigestReport = {
  sessionYmd: '2026-11-05',
  shortLabel: 'Thu 5 Nov',
  headline: 'NSE Thu 5 Nov 2026: 26 stocks rose, 17 fell',
  summary: 'On Thursday 26 of 58 traded stocks rose and 17 fell.',
  url: 'https://nseacademy.vitaldigitalmedia.net/market-report/2026-11-05',
  facts: {
    breadth: { advancers: 26, decliners: 17, unchanged: 15, traded: 58 },
    valueTradedKes: 405_800_000,
    avgValueTradedKes: 627_200_000,
    valueVsAvgPct: -35.3,
    gainers: [{ ticker: 'CRWN', name: 'Crown Berger', price: 61, changePct: 6.09, valueKes: 7e6, volume: 1 }, { ticker: 'SCOM', name: 'Safaricom', price: 35.2, changePct: 3.68, valueKes: 1e8, volume: 1 }],
    losers: [{ ticker: 'OCH', name: 'Olympia', price: 13.5, changePct: -10, valueKes: 1e6, volume: 1 }],
  },
};
const series = new Map([
  ['SCOM', [{ date: '2026-11-04', price: 34 }, { date: '2026-11-05', price: 35.2 }]],
  ['KCB', [{ date: '2026-11-04', price: 90 }, { date: '2026-11-05', price: 89.75 }]],
  ['OLDY', [{ date: '2026-11-02', price: 10 }, { date: '2026-11-03', price: 11 }]], // did not trade on the session
]);

describe('buildDigestPortfolio', () => {
  it('prices holdings at the close and totals the day, biggest movers first', () => {
    const p = buildDigestPortfolio([{ ticker: 'SCOM', quantity: 1000 }, { ticker: 'KCB', quantity: 100 }], series, '2026-11-05')!;
    expect(p.holdings[0].ticker).toBe('SCOM');
    expect(p.valueKes).toBeCloseTo(35_200 + 8_975, 6);
    expect(p.dayChangeKes).toBeCloseTo(1200 - 25, 6);
    expect(p.dayChangePct).toBeCloseTo((1175 / (34_000 + 9_000)) * 100, 6);
  });

  it('shows no move for a stock that did not trade that day, and merges the same ticker across brokers', () => {
    const p = buildDigestPortfolio([{ ticker: 'OLDY', quantity: 10 }, { ticker: 'SCOM', quantity: 500 }, { ticker: 'SCOM', quantity: 500 }], series, '2026-11-05')!;
    expect(p.holdings.find((h) => h.ticker === 'OLDY')!.dayChangePct).toBeNull();
    expect(p.holdings.filter((h) => h.ticker === 'SCOM')).toHaveLength(1);
    expect(p.holdings.find((h) => h.ticker === 'SCOM')!.quantity).toBe(1000);
  });

  it('prices holdings at the report\'s session even when later closes exist', () => {
    const later = new Map([['SCOM', [{ date: '2026-11-04', price: 34 }, { date: '2026-11-05', price: 35.2 }, { date: '2026-11-06', price: 40 }]]]);
    const p = buildDigestPortfolio([{ ticker: 'SCOM', quantity: 1000 }], later, '2026-11-05')!;
    expect(p.valueKes).toBeCloseTo(35_200, 6);
    expect(p.holdings[0].dayChangePct).toBeCloseTo(((35.2 - 34) / 34) * 100, 6);
  });

  it('is null with nothing priced', () => {
    expect(buildDigestPortfolio([], series, '2026-11-05')).toBeNull();
    expect(buildDigestPortfolio([{ ticker: 'NOPE', quantity: 5 }], series, '2026-11-05')).toBeNull();
  });
});

describe('renderDigest', () => {
  const base = { firstName: 'Jane Doe', report, siteUrl: 'https://x.test', unsubscribeUrl: 'https://x.test/digest/unsubscribe?u=1&t=abc', manageUrl: 'https://x.test/dashboard/account' };

  it('leads with the member\'s portfolio move in the subject when they have holdings', () => {
    const p = buildDigestPortfolio([{ ticker: 'SCOM', quantity: 1000 }], series, '2026-11-05');
    const out = renderDigest({ ...base, portfolio: p, isPremium: false });
    expect(out.subject).toMatch(/Your portfolio \+3\.53%/);
    expect(out.html).toContain('Your portfolio today');
    expect(out.html).toContain('Premium members also get Portfolio Watch');
    expect(out.html).toContain(base.unsubscribeUrl);
    expect(out.text).toContain('Stop this email');
  });

  it('does not upsell Premium members, and omits the portfolio block for members with no holdings', () => {
    const p = buildDigestPortfolio([{ ticker: 'SCOM', quantity: 1000 }], series, '2026-11-05');
    expect(renderDigest({ ...base, portfolio: p, isPremium: true }).html).not.toContain('Premium members also get');
    const none = renderDigest({ ...base, portfolio: null, isPremium: false });
    expect(none.html).not.toContain('Your portfolio today');
    expect(none.subject).toContain('KSh 405.8M traded');
  });

  it('states the value-traded comparison the way the report does and never says "sell"', () => {
    const out = renderDigest({ ...base, portfolio: null, isPremium: false });
    expect(out.html).toContain('35% below its recent average');
    expect(out.html).not.toMatch(/\bsell\b/i);
  });
});

describe('digest unsubscribe token', () => {
  it('verifies only for the same member and secret', () => {
    const t = digestToken('user1', 's3cret');
    expect(verifyDigestToken('user1', t, 's3cret')).toBe(true);
    expect(verifyDigestToken('user2', t, 's3cret')).toBe(false);
    expect(verifyDigestToken('user1', t, 'other')).toBe(false);
    expect(verifyDigestToken('user1', 'short', 's3cret')).toBe(false);
  });
});

describe('MarketDigestService.runAll', () => {
  function make(opts: { sessionYmd?: string; users?: { id: string; email: string; name: string }[] } = {}) {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(opts.users ?? [{ id: 'u1', email: 'a@x.com', name: 'A' }, { id: 'u2', email: 'b@x.com', name: 'B' }]),
        findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, email: `${where.id}@x.com`, name: 'N', digestLastSentOn: null, subscription: null, holdings: [] })),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const reports = { getLatestPublic: jest.fn().mockResolvedValue({ sessionYmd: opts.sessionYmd ?? '2026-11-05', headline: report.headline, summary: report.summary, url: report.url, facts: { ...report.facts, shortLabel: report.shortLabel } }) };
    const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn((k: string) => (k === 'JWT_SECRET' ? 'secret' : undefined)) };
    const svc = new MarketDigestService(prisma as never, reports as never, brevo as never, config as never);
    return { svc, prisma, brevo };
  }
  const evening = new Date('2026-11-05T18:20:00Z'); // 21:20 in Nairobi

  it('sends to opted-in members and marks the session as sent', async () => {
    const { svc, prisma, brevo } = make();
    const out = await svc.runAll(evening);
    expect(out).toMatchObject({ session: '2026-11-05', considered: 2, sent: 2, failed: 0 });
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { digestLastSentOn: '2026-11-05' } }));
    expect(prisma.user.findMany.mock.calls[0][0].where.digestEnabled).toBe(true);
  });

  it('sends nothing when the latest report is not today\'s session', async () => {
    const { svc, brevo } = make({ sessionYmd: '2026-11-04' });
    const out = await svc.runAll(evening);
    expect(out.sent).toBe(0);
    expect(out.note).toMatch(/not published/);
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('counts a failure and carries on with the next member', async () => {
    const { svc, brevo } = make();
    brevo.sendTransactional.mockRejectedValueOnce(new Error('brevo down')).mockResolvedValue(undefined);
    const out = await svc.runAll(evening);
    expect(out).toMatchObject({ sent: 1, failed: 1 });
  });

  it('only accepts a genuine unsubscribe link', async () => {
    const { svc, prisma } = make();
    expect(await svc.unsubscribe('u1', 'x'.repeat(32))).toBe(false);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(await svc.unsubscribe('u1', digestToken('u1', 'secret'))).toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { digestEnabled: false } });
  });
});

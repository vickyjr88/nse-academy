import { PortfolioWatchService } from './portfolio-watch.service';

// 16:30 Nairobi on Thu 5 Nov 2026.
const NOW = new Date('2026-11-05T13:30:00Z');

function rawRows(ticker: string, prices: number[], lastDate = '2026-11-05') {
  const end = new Date(`${lastDate}T00:00:00Z`).getTime();
  return prices.map((price, i) => ({ ticker, d: new Date(end - (prices.length - 1 - i) * 86_400_000).toISOString().slice(0, 10), price }));
}

function make(opts: {
  holdings?: { ticker: string; quantity: number; avgCost: number | null; costSource: string | null }[];
  rows?: { ticker: string; d: string; price: number }[];
  alreadySent?: boolean;
  lastSent?: { key: string; at: Date }[];
  optedIn?: boolean;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Vicky Junior', email: 'v@example.com', portfolioWatchEnabled: opts.optedIn ?? true }),
      findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    },
    holding: { findMany: jest.fn().mockResolvedValue(opts.holdings ?? []) },
    $queryRaw: jest.fn().mockResolvedValue(opts.rows ?? []),
    notification: {
      findFirst: jest.fn().mockResolvedValue(opts.alreadySent ? { id: 'n0' } : null),
      create: jest.fn().mockResolvedValue({}),
    },
    portfolioAlertLog: {
      groupBy: jest.fn().mockResolvedValue((opts.lastSent ?? []).map((l) => ({ key: l.key, _max: { sentAt: l.at } }))),
      createMany: jest.fn().mockResolvedValue({}),
    },
  };
  const brevo = { sendTransactional: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  return { service: new PortfolioWatchService(prisma as never, brevo as never, config as never), prisma, brevo };
}

const NSE_UP = {
  holdings: [{ ticker: 'NSE', quantity: 5000, avgCost: 26.05, costSource: 'IMPORT_PRICE' }, { ticker: 'SCOM', quantity: 100, avgCost: 36.6, costSource: 'IMPORT_PRICE' }],
  rows: [...rawRows('NSE', [33.65, 33.65, 33.65]), ...rawRows('SCOM', [33.9, 35.2])],
};

describe('PortfolioWatchService.sendForUser', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('does nothing for a user with no holdings', async () => {
    const { service, brevo } = make({});
    expect((await service.sendForUser('u1')).status).toBe('no-holdings');
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('stays quiet when there was no trading today (holiday or the feed was down)', async () => {
    const { service, brevo } = make({ ...NSE_UP, rows: [...rawRows('NSE', [33, 33.65], '2026-11-04'), ...rawRows('SCOM', [33.9, 35.2], '2026-11-04')] });
    expect((await service.sendForUser('u1')).status).toBe('no-session-today');
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('does not send a second time on the same day', async () => {
    const { service, brevo } = make({ ...NSE_UP, alreadySent: true });
    expect((await service.sendForUser('u1')).status).toBe('already-sent-today');
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('records a notification, logs cooldown keys (not movers) and emails the user when there is something to report', async () => {
    const { service, prisma, brevo } = make(NSE_UP);
    const out = await service.sendForUser('u1');
    expect(out.status).toBe('sent');
    const keys = out.fresh!.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['TAKE_PROFIT:NSE', 'MOVER:SCOM']));
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u1', type: 'PORTFOLIO_WATCH' });
    const logged = prisma.portfolioAlertLog.createMany.mock.calls[0][0].data.map((d: { key: string }) => d.key);
    expect(logged).toContain('TAKE_PROFIT:NSE');
    expect(logged).not.toContain('MOVER:SCOM');
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(1);
    const mail = brevo.sendTransactional.mock.calls[0][0];
    expect(mail.to.email).toBe('v@example.com');
    expect(mail.subject).toMatch(/Portfolio watch - Thu 5 Nov: \d things? to look at/);
    expect(mail.htmlContent).toContain('Worth a look');
    expect(mail.htmlContent).toContain('est.');
    expect(mail.htmlContent).toContain('Hi Vicky');
  });

  it('still records the in-app notification but does not email a user who turned the email off', async () => {
    const { service, prisma, brevo } = make({ ...NSE_UP, optedIn: false });
    expect((await service.sendForUser('u1')).status).toBe('sent');
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('suppresses a prompt that was sent inside its cooldown and reports nothing-to-report when that was all there was', async () => {
    const { service, brevo } = make({
      holdings: [{ ticker: 'NSE', quantity: 5000, avgCost: 26.05, costSource: 'MANUAL' }],
      rows: rawRows('NSE', [33.65, 33.65]),
      lastSent: [{ key: 'TAKE_PROFIT:NSE', at: new Date(NOW.getTime() - 86_400_000) }],
    });
    expect((await service.sendForUser('u1')).status).toBe('nothing-to-report');
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('dry run reports what would be sent without writing or emailing', async () => {
    const { service, prisma, brevo } = make(NSE_UP);
    const out = await service.sendForUser('u1', { dryRun: true });
    expect(out.status).toBe('dry-run');
    expect(out.items).toBeGreaterThan(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.portfolioAlertLog.createMany).not.toHaveBeenCalled();
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('force bypasses the trading-day and once-a-day checks', async () => {
    const { service } = make({ ...NSE_UP, alreadySent: true, rows: [...rawRows('NSE', [33, 33.65], '2026-11-04'), ...rawRows('SCOM', [33.9, 35.2], '2026-11-04')] });
    expect((await service.sendForUser('u1', { force: true })).status).toBe('sent');
  });
});

describe('PortfolioWatchService.renderEmail', () => {
  it('escapes names and tickers so nothing user-controlled can inject markup', () => {
    const { service } = make({});
    const result = {
      asOf: '2026-11-05',
      valueKes: 1000,
      dayChangeKes: 10,
      dayChangePct: 1,
      costKes: null,
      unrealizedKes: null,
      unrealizedPct: null,
      costEstimated: false,
      holdings: [{ ticker: '<b>X</b>', quantity: 1, price: 1, valueKes: 1, weightPct: 100, dayChangePct: 0, avgCost: null, costEstimated: false, gainPct: null }],
      items: [],
    };
    const items = [{ kind: 'MOVER' as const, ticker: '<b>X</b>', key: 'MOVER:<b>X</b>', text: '<script>alert(1)</script> moved', cooldownDays: 0 }];
    const { html } = service.renderEmail('<img src=x>', result, items);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
  });
});

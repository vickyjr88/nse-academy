import { BadRequestException } from '@nestjs/common';
import { MarketDigestService, summarizeRun } from './market-digest.service';
import { digestToken } from './digest';

// 25 Nov 2026, 21:20 in Nairobi
const evening = new Date('2026-11-25T18:20:00Z');
const nextMorning = new Date('2026-11-26T08:00:00Z');

const publicReport = (ymd: string) => ({
  sessionYmd: ymd,
  headline: 'Headline',
  summary: 'Summary',
  url: `https://x.test/market-report/${ymd}`,
  facts: { shortLabel: 'Wed 25 Nov', breadth: { advancers: 16, decliners: 37, unchanged: 14, traded: 67 }, valueTradedKes: 5e8, avgValueTradedKes: 6e8, valueVsAvgPct: -10, gainers: [], losers: [] },
});

type SendResult = { sent: true } | { sent: false; blocked: boolean; reason: string };

function make(members: string[], results: Record<string, SendResult> = {}) {
  const updated: string[] = [];
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(members.map((id) => ({ id, email: `${id}@x.test`, name: id }))),
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) => ({ id: where.id ?? 'm1', email: `${where.id ?? 'm1'}@x.test`, name: 'Member', digestLastSentOn: null, subscription: null, holdings: [] })),
      update: jest.fn(async ({ where }: { where: { id: string } }) => void updated.push(where.id)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const brevo = {
    sendTransactional: jest.fn(async ({ to }: { to: { email: string } }) => results[to.email.split('@')[0]] ?? { sent: true }),
    blockReason: jest.fn(async (email: string) => {
      const r = results[email.split('@')[0]];
      return r && r.sent === false && r.blocked ? r.reason : null;
    }),
  };
  const reports = {
    getLatestPublic: jest.fn().mockResolvedValue(publicReport('2026-11-25')),
    getPublic: jest.fn(async (ymd: string) => publicReport(ymd)),
  };
  const config = { get: jest.fn((k: string) => (k === 'WEB_URL' ? 'https://x.test' : k === 'JWT_SECRET' ? 'secret' : undefined)) };
  const service = new MarketDigestService(prisma as never, reports as never, brevo as never, config as never);
  return { service, prisma, brevo, reports, updated };
}

describe('MarketDigestService.runAll', () => {
  it('counts sent, blocked and failed separately, and marks only the members whose email really left', async () => {
    const { service, updated } = make(['m1', 'm2', 'm3', 'm4'], {
      m2: { sent: false, blocked: true, reason: 'address is suppressed (bounced, blocked or unsubscribed)' },
      m3: { sent: false, blocked: false, reason: 'Brevo 402: not enough credits' },
    });
    const out = await service.runAll(evening);
    expect(out).toMatchObject({ session: '2026-11-25', considered: 4, sent: 2, blocked: 1, failed: 1, skipped: 0 });
    expect(out.reasons).toEqual({ 'address is suppressed (bounced, blocked or unsubscribed)': 1, 'Brevo 402: not enough credits': 1 });
    expect(updated).toEqual(['m1', 'm4']);
    expect(summarizeRun(out)).toBe('2 sent, 1 blocked, 1 failed, 0 already had it, of 4');
  });

  it('only picks members who have it on, have not opted out and have not had this session', async () => {
    const { service, prisma } = make([]);
    await service.runAll(evening);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { digestEnabled: true, digestOptedOutAt: null, AND: { OR: [{ digestLastSentOn: null }, { digestLastSentOn: { not: '2026-11-25' } }] } },
      }),
    );
  });

  it('sends nothing in the morning when today has no report yet', async () => {
    const { service, brevo } = make(['m1']);
    const out = await service.runAll(nextMorning);
    expect(out.note).toMatch(/not published/);
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('can send a named recent session the next day, as a catch-up', async () => {
    const { service, reports, brevo } = make(['m1', 'm2']);
    const out = await service.runAll(nextMorning, { session: '2026-11-25' });
    expect(reports.getPublic).toHaveBeenCalledWith('2026-11-25');
    expect(out).toMatchObject({ session: '2026-11-25', sent: 2 });
    expect(brevo.sendTransactional).toHaveBeenCalledTimes(2);
  });

  it('refuses a session older than a week or in the future, so old news cannot go out by mistake', async () => {
    const { service, brevo } = make(['m1']);
    await expect(service.runAll(nextMorning, { session: '2026-11-01' })).rejects.toThrow(BadRequestException);
    await expect(service.runAll(nextMorning, { session: '2026-11-27' })).rejects.toThrow(BadRequestException);
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
  });

  it('a dry run reports who would get it and who would be blocked, and sends and marks nothing', async () => {
    const { service, brevo, updated } = make(['m1', 'm2', 'm3'], { m3: { sent: false, blocked: true, reason: 'domain has no mail server' } });
    const out = await service.runAll(nextMorning, { session: '2026-11-25', dryRun: true });
    expect(out).toMatchObject({ dryRun: true, considered: 3, sent: 2, blocked: 1, failed: 0, reasons: { 'domain has no mail server': 1 } });
    expect(brevo.sendTransactional).not.toHaveBeenCalled();
    expect(updated).toEqual([]);
    expect(summarizeRun(out)).toContain('2 would be sent');
  });

  it('carries on after one member throws', async () => {
    const { service, brevo } = make(['m1', 'm2']);
    brevo.sendTransactional.mockRejectedValueOnce(new Error('boom'));
    const out = await service.runAll(evening);
    expect(out).toMatchObject({ sent: 1, failed: 1 });
  });
});

describe('opting out', () => {
  it('records that the member switched it off, and clears the record if they switch it back on', async () => {
    const { service, prisma } = make([]);
    await service.setPreference('m1', false);
    expect(prisma.user.update).toHaveBeenLastCalledWith({ where: { id: 'm1' }, data: { digestEnabled: false, digestOptedOutAt: expect.any(Date) } } as never);
    await service.setPreference('m1', true);
    expect(prisma.user.update).toHaveBeenLastCalledWith({ where: { id: 'm1' }, data: { digestEnabled: true, digestOptedOutAt: null } } as never);
  });

  it('records an opt-out from the one-click link, and ignores a forged one', async () => {
    const { service, prisma } = make([]);
    await expect(service.unsubscribe('m1', 'x'.repeat(32))).resolves.toBe(false);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    await expect(service.unsubscribe('m1', digestToken('m1', 'secret'))).resolves.toBe(true);
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { digestEnabled: false, digestOptedOutAt: expect.any(Date) } });
  });
});

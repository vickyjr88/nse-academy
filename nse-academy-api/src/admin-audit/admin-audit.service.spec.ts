import { AdminAuditService } from './admin-audit.service';

function make() {
  const prisma = {
    adminAuditLog: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([{ id: '1' }]),
      count: jest.fn().mockResolvedValue(120),
      groupBy: jest.fn().mockResolvedValue([{ actor: 'a@x.com', _count: { _all: 4 } }, { actor: null, _count: { _all: 1 } }]),
      deleteMany: jest.fn().mockResolvedValue({ count: 7 }),
    },
  };
  return { svc: new AdminAuditService(prisma as never), prisma };
}

describe('AdminAuditService', () => {
  it('stores an entry, trimming long paths and actions', async () => {
    const { svc, prisma } = make();
    await svc.record({ actor: 'a@x.com', method: 'POST', path: '/admin/' + 'x'.repeat(500), action: 'y'.repeat(900), entityType: null, entityId: null, statusCode: 201, ok: true, detail: { a: 1 } });
    const data = prisma.adminAuditLog.create.mock.calls[0][0].data;
    expect(data.path).toHaveLength(300);
    expect(data.action).toHaveLength(400);
    expect(data.detail).toEqual({ a: 1 });
  });
  it('never throws when the write fails', async () => {
    const { svc, prisma } = make();
    prisma.adminAuditLog.create.mockRejectedValue(new Error('db down'));
    await expect(svc.record({ actor: null, method: 'POST', path: '/admin/x', action: 'a', entityType: null, entityId: null, statusCode: 200, ok: true })).resolves.toBeUndefined();
  });
  it('lists newest first with filters and bounded paging', async () => {
    const { svc, prisma } = make();
    const out = await svc.list({ actor: 'a@x.com', method: 'put', q: 'holding', failedOnly: true, page: 2, limit: 999 });
    const args = prisma.adminAuditLog.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ actor: 'a@x.com', method: 'PUT', ok: false });
    expect(args.where.OR).toHaveLength(2);
    expect(args).toMatchObject({ orderBy: { at: 'desc' }, skip: 200, take: 200 });
    expect(out).toMatchObject({ total: 120, page: 2, totalPages: 1 });
  });
  it('filters changes with no recorded person by the "unknown" label the dropdown shows', async () => {
    const { svc, prisma } = make();
    await svc.list({ actor: 'unknown' });
    expect(prisma.adminAuditLog.findMany.mock.calls[0][0].where.actor).toBeNull();
  });
  it('summarises changes per actor, busiest first', async () => {
    const { svc, prisma } = make();
    prisma.adminAuditLog.findMany.mockResolvedValue([{ actor: 'a@x.com', action: 'Did a thing', ok: true }]);
    const s = await svc.summary(new Date('2026-11-05'), new Date('2026-11-06'));
    expect(s).toMatchObject({ total: 5, failed: 120, byActor: [{ actor: 'a@x.com', count: 4 }, { actor: 'unknown', count: 1 }], recent: [{ actor: 'a@x.com', action: 'Did a thing', ok: true }] });
  });
  it('prunes entries past the retention period', async () => {
    const { svc } = make();
    await expect(svc.prune(365)).resolves.toBe(7);
  });
});

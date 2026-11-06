import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';

function make() {
  const prisma = {
    tag: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([
        { id: 't1', name: 'engaged-free', createdAt: new Date('2026-10-01'), _count: { users: 12 } },
        { id: 't2', name: 'vip', createdAt: new Date('2026-10-02'), _count: { users: 3 } },
      ]),
      update: jest.fn(async ({ data }: any) => ({ id: 't2', ...data })),
    },
    user: { findMany: jest.fn() },
    userTag: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(3), createMany: jest.fn() },
  };
  const svc = new LifecycleService(prisma as never, { sendTransactional: jest.fn() } as never, { get: jest.fn() } as never);
  return { svc, prisma };
}

describe('LifecycleService - tag management', () => {
  it('marks the tags the automation owns, so the admin can warn about them', async () => {
    const list = await make().svc.listTags();
    expect(list.map((t) => [t.name, t.system, t.memberCount])).toEqual([['engaged-free', true, 12], ['vip', false, 3]]);
  });

  describe('renameTag', () => {
    it('renames a manual tag', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValueOnce({ id: 't2', name: 'vip' }).mockResolvedValueOnce(null);
      await svc.renameTag('t2', 'vip-members');
      expect(prisma.tag.update).toHaveBeenCalledWith({ where: { id: 't2' }, data: { name: 'vip-members' } });
    });
    it('refuses to rename a tag the automation looks up by name, which would orphan its members', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValue({ id: 't1', name: 'active-trader-free' });
      await expect(svc.renameTag('t1', 'traders')).rejects.toThrow(BadRequestException);
      expect(prisma.tag.update).not.toHaveBeenCalled();
    });
    it('refuses a name that is taken, 404s an unknown tag, and does nothing for an unchanged name', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValueOnce({ id: 't2', name: 'vip' }).mockResolvedValueOnce({ id: 't3', name: 'taken' });
      await expect(svc.renameTag('t2', 'taken')).rejects.toThrow(ConflictException);
      prisma.tag.findUnique.mockResolvedValueOnce(null);
      await expect(svc.renameTag('nope', 'x-y')).rejects.toThrow(NotFoundException);
      prisma.tag.findUnique.mockResolvedValueOnce({ id: 't2', name: 'vip' });
      await svc.renameTag('t2', 'vip');
      expect(prisma.tag.update).not.toHaveBeenCalled();
    });
  });

  describe('listTagMembers', () => {
    it('shows who has the tag and whether the automation or a person applied it', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValue({ id: 't2', name: 'vip' });
      prisma.userTag.findMany.mockResolvedValue([
        { addedAt: new Date('2026-11-01'), addedBy: 'admin:manual', user: { id: 'u1', name: 'Ann', email: 'ann@x.com' } },
        { addedAt: new Date('2026-10-30'), addedBy: 'system:lesson-engagement', user: { id: 'u2', name: 'Bob', email: 'bob@x.com' } },
      ]);
      const out = await svc.listTagMembers('t2', 2, 9999);
      expect(prisma.userTag.findMany.mock.calls[0][0]).toMatchObject({ where: { tagId: 't2' }, orderBy: { addedAt: 'desc' }, skip: 100, take: 100 });
      expect(out.data.map((m) => [m.email, m.automated])).toEqual([['ann@x.com', false], ['bob@x.com', true]]);
      expect(out.tag).toEqual({ id: 't2', name: 'vip', system: false });
      expect(out).toMatchObject({ total: 3, page: 2 });
    });
    it('404s an unknown tag', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValue(null);
      await expect(svc.listTagMembers('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyTagByEmail', () => {
    it('tags members by address, ignoring case, spaces and duplicates, and reports the addresses that match nobody', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValue({ id: 't2', name: 'vip' });
      prisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'ann@x.com' }, { id: 'u2', email: 'bob@x.com' }]);
      prisma.userTag.createMany.mockResolvedValue({ count: 1 });
      const out = await svc.applyTagByEmail('t2', [' Ann@X.com ', 'ann@x.com', 'BOB@x.com', 'ghost@x.com']);
      expect(prisma.user.findMany.mock.calls[0][0].where.email.in).toEqual(['ann@x.com', 'bob@x.com', 'ghost@x.com']);
      expect(prisma.userTag.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true, data: [{ userId: 'u1', tagId: 't2', addedBy: 'admin:manual' }, { userId: 'u2', tagId: 't2', addedBy: 'admin:manual' }] });
      expect(out).toEqual({ tagged: 1, alreadyHadTag: 1, notFound: ['ghost@x.com'] });
    });
    it('rejects the request when none of the addresses is a member, and 404s an unknown tag', async () => {
      const { svc, prisma } = make();
      prisma.tag.findUnique.mockResolvedValue({ id: 't2', name: 'vip' });
      prisma.user.findMany.mockResolvedValue([]);
      await expect(svc.applyTagByEmail('t2', ['ghost@x.com'])).rejects.toThrow(/belongs to a member/);
      prisma.tag.findUnique.mockResolvedValue(null);
      await expect(svc.applyTagByEmail('nope', ['a@b.c'])).rejects.toThrow(NotFoundException);
    });
  });
});

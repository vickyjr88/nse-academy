import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actor: string | null;
  method: string;
  path: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  statusCode: number;
  ok: boolean;
  detail?: unknown;
  ip?: string | null;
}

export interface AuditFilter {
  actor?: string;
  method?: string;
  q?: string;
  entityType?: string;
  entityId?: string;
  failedOnly?: boolean;
  page?: number;
  limit?: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(Number.isFinite(n) ? n : lo, lo), hi);

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private prisma: PrismaService) {}

  /** Never throws: the trail must not be the thing that fails an admin's action. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          actor: entry.actor,
          method: entry.method,
          path: entry.path.slice(0, 300),
          action: entry.action.slice(0, 400),
          entityType: entry.entityType,
          entityId: entry.entityId,
          statusCode: entry.statusCode,
          ok: entry.ok,
          detail: entry.detail === undefined ? Prisma.JsonNull : (entry.detail as Prisma.InputJsonValue),
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record an audit entry (${entry.action}): ${(err as Error).message}`);
    }
  }

  async list(f: AuditFilter = {}) {
    const take = clamp(f.limit ?? 50, 1, 200);
    const page = Math.max(f.page ?? 1, 1);
    const where: Prisma.AdminAuditLogWhereInput = {};
    if (f.actor) where.actor = f.actor === 'unknown' ? null : f.actor;
    if (f.method) where.method = f.method.toUpperCase();
    if (f.entityType) where.entityType = f.entityType;
    if (f.entityId) where.entityId = f.entityId;
    if (f.failedOnly) where.ok = false;
    if (f.q) where.OR = [{ action: { contains: f.q, mode: 'insensitive' } }, { path: { contains: f.q, mode: 'insensitive' } }];
    const [data, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({ where, orderBy: { at: 'desc' }, skip: (page - 1) * take, take }),
      this.prisma.adminAuditLog.count({ where }),
    ]);
    return { data, total, page, limit: take, totalPages: Math.ceil(total / take) };
  }

  /** Who has made changes, for the filter dropdown. */
  async actors(): Promise<string[]> {
    const rows = await this.prisma.adminAuditLog.groupBy({ by: ['actor'], _count: true, orderBy: { _count: { actor: 'desc' } } });
    return rows.map((r) => r.actor ?? 'unknown');
  }

  /** Changes made between two instants, per actor, for the daily report. */
  async summary(from: Date, to: Date) {
    const rows = await this.prisma.adminAuditLog.groupBy({ by: ['actor'], where: { at: { gte: from, lt: to } }, _count: { _all: true } });
    const failed = await this.prisma.adminAuditLog.count({ where: { at: { gte: from, lt: to }, ok: false } });
    const recent = await this.prisma.adminAuditLog.findMany({ where: { at: { gte: from, lt: to } }, orderBy: { at: 'desc' }, take: 8, select: { actor: true, action: true, ok: true } });
    return {
      total: rows.reduce((n, r) => n + r._count._all, 0),
      failed,
      byActor: rows.map((r) => ({ actor: r.actor ?? 'unknown', count: r._count._all })).sort((a, b) => b.count - a.count),
      recent: recent.map((r) => ({ actor: r.actor ?? 'unknown', action: r.action, ok: r.ok })),
    };
  }

  async prune(keepDays = 365): Promise<number> {
    const { count } = await this.prisma.adminAuditLog.deleteMany({ where: { at: { lt: new Date(Date.now() - keepDays * 86_400_000) } } });
    return count;
  }
}

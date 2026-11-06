import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AiCallRecord {
  feature: 'advisor' | 'market-report';
  model?: string | null;
  ok: boolean;
  verified?: boolean | null;
  attempts?: number;
  durationMs?: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
  costUsd?: number | null;
  userId?: string | null;
  detail?: string | null;
}

export interface AiUsageRow {
  feature: string;
  model: string | null;
  calls: number;
  failed: number;
  verified: number;
  unverified: number;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  avgSeconds: number | null;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private prisma: PrismaService) {}

  /** Never throws: usage logging must not break the feature it observes. */
  async record(call: AiCallRecord): Promise<void> {
    try {
      await this.prisma.aiCall.create({
        data: {
          feature: call.feature,
          model: call.model ?? null,
          ok: call.ok,
          verified: call.verified ?? null,
          attempts: call.attempts ?? 1,
          durationMs: call.durationMs ?? null,
          promptTokens: call.promptTokens ?? null,
          completionTokens: call.completionTokens ?? null,
          costUsd: call.costUsd ?? null,
          userId: call.userId ?? null,
          detail: call.detail ? call.detail.slice(0, 300) : null,
        },
      });
    } catch (err) {
      this.logger.warn(`Could not record an AI call: ${(err as Error).message}`);
    }
  }

  /** Calls, failures, verification rate and spend per feature and model between two instants. */
  async summary(from: Date, to: Date): Promise<AiUsageRow[]> {
    const rows = await this.prisma.aiCall.groupBy({
      by: ['feature', 'model'],
      where: { createdAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { costUsd: true, promptTokens: true, completionTokens: true, durationMs: true },
    });
    const out: AiUsageRow[] = [];
    for (const r of rows) {
      const where = { feature: r.feature, model: r.model, createdAt: { gte: from, lt: to } };
      const [failed, verified, unverified] = await Promise.all([
        this.prisma.aiCall.count({ where: { ...where, ok: false } }),
        this.prisma.aiCall.count({ where: { ...where, verified: true } }),
        this.prisma.aiCall.count({ where: { ...where, verified: false } }),
      ]);
      out.push({
        feature: r.feature,
        model: r.model,
        calls: r._count._all,
        failed,
        verified,
        unverified,
        costUsd: r._sum.costUsd ?? 0,
        promptTokens: r._sum.promptTokens ?? 0,
        completionTokens: r._sum.completionTokens ?? 0,
        avgSeconds: r._sum.durationMs != null && r._count._all ? Math.round(r._sum.durationMs / r._count._all / 100) / 10 : null,
      });
    }
    return out.sort((a, b) => b.calls - a.calls);
  }

  async prune(keepDays = 180): Promise<number> {
    const { count } = await this.prisma.aiCall.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - keepDays * 86_400_000) } } });
    return count;
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Lead, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CaptureLeadInput {
  email: string;
  name?: string | null;
  magnetSlug: string;
  source?: string | null;
  referralCode?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}

@Injectable()
export class LeadsService {
  private readonly log = new Logger(LeadsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Idempotent capture: the same (email, magnetSlug) returns the existing
   * row updated with any fresh attribution (later visits with new UTMs win).
   * No row leak when users retry, and we can answer "how many times did
   * they touch this magnet?" by counting download events instead.
   */
  async capture(input: CaptureLeadInput): Promise<Lead> {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('Invalid email');
    }
    if (!input.magnetSlug) {
      throw new BadRequestException('magnetSlug is required');
    }
    const data = {
      email,
      name: input.name?.trim() || null,
      magnetSlug: input.magnetSlug,
      source: input.source ?? null,
      referralCode: input.referralCode ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmTerm: input.utmTerm ?? null,
      utmContent: input.utmContent ?? null,
    };
    return this.prisma.lead.upsert({
      where: {
        email_magnetSlug: { email, magnetSlug: input.magnetSlug },
      },
      create: data,
      // On re-submit, refresh attribution + capture the latest non-null
      // name. We deliberately do NOT reset downloadCount or downloadedAt.
      update: {
        name: data.name ?? undefined,
        source: data.source,
        referralCode: data.referralCode,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        utmTerm: data.utmTerm,
        utmContent: data.utmContent,
      },
    });
  }

  /** Tick the download counter — called from the success page on link click. */
  async recordDownload(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.lead.update({
      where: { id },
      data: {
        downloadCount: { increment: 1 },
        downloadedAt: new Date(),
      },
    });
  }

  async list(query: {
    page?: number;
    limit?: number;
    magnetSlug?: string;
    q?: string;
  }) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
    const skip = (page - 1) * limit;
    const where: Prisma.LeadWhereInput = {};
    if (query.magnetSlug) where.magnetSlug = query.magnetSlug;
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** CSV export for admins who want the list in a spreadsheet. */
  async exportCsv(magnetSlug?: string): Promise<string> {
    const where: Prisma.LeadWhereInput = magnetSlug ? { magnetSlug } : {};
    const rows = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const header = [
      'createdAt',
      'email',
      'name',
      'magnetSlug',
      'source',
      'referralCode',
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'downloadCount',
      'downloadedAt',
      'convertedAt',
    ];
    const escape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.createdAt.toISOString(),
          r.email,
          r.name ?? '',
          r.magnetSlug,
          r.source ?? '',
          r.referralCode ?? '',
          r.utmSource ?? '',
          r.utmMedium ?? '',
          r.utmCampaign ?? '',
          r.downloadCount,
          r.downloadedAt?.toISOString() ?? '',
          r.convertedAt?.toISOString() ?? '',
        ]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  async stats() {
    const [total, byMagnet, downloaded, converted] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.groupBy({
        by: ['magnetSlug'],
        _count: { _all: true },
      }),
      this.prisma.lead.count({ where: { downloadCount: { gt: 0 } } }),
      this.prisma.lead.count({ where: { convertedAt: { not: null } } }),
    ]);
    return {
      total,
      downloaded,
      converted,
      conversionRate: total > 0 ? converted / total : 0,
      byMagnet: byMagnet.map((b) => ({
        magnetSlug: b.magnetSlug,
        count: b._count._all,
      })),
    };
  }
}

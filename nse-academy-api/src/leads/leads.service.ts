import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lead, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';

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
  private readonly brevoListId?: number;
  private readonly brevoTemplateId?: number;
  private readonly siteUrl: string;

  constructor(
    private prisma: PrismaService,
    private brevo: BrevoService,
    private config: ConfigService,
  ) {
    const listIdRaw = this.config.get<string>('BREVO_LIST_ID');
    this.brevoListId = listIdRaw ? Number(listIdRaw) : undefined;
    const templateIdRaw = this.config.get<string>(
      'BREVO_LEAD_MAGNET_TEMPLATE_ID',
    );
    this.brevoTemplateId = templateIdRaw ? Number(templateIdRaw) : undefined;
    this.siteUrl =
      this.config.get<string>('SITE_URL') ??
      'https://nseacademy.vitaldigitalmedia.net';
  }

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
    const lead = await this.prisma.lead.upsert({
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

    // Fire-and-forget Brevo sync — must not block the capture response.
    // The service handles missing API key + per-call errors internally.
    void this.syncToBrevo(lead, input.magnetSlug);

    return lead;
  }

  /**
   * Push the lead to Brevo as a contact and trigger the welcome email with
   * the PDF link. Called from capture() in fire-and-forget mode.
   */
  private async syncToBrevo(lead: Lead, magnetSlug: string): Promise<void> {
    if (!this.brevo.hasCredentials()) return;

    // Brevo contact attributes — UPPERCASE keys, must match the contact
    // attributes you've defined in your Brevo project. The standard ones
    // (FIRSTNAME, LASTNAME) live by default; the rest you create once in the
    // Brevo dashboard.
    const attributes: Record<string, unknown> = {
      FIRSTNAME: lead.name?.split(' ')[0] ?? null,
      LASTNAME: lead.name?.split(' ').slice(1).join(' ') || null,
      MAGNET_SLUG: magnetSlug,
      SOURCE: lead.source,
      REFERRAL_CODE: lead.referralCode,
      UTM_SOURCE: lead.utmSource,
      UTM_MEDIUM: lead.utmMedium,
      UTM_CAMPAIGN: lead.utmCampaign,
      REGISTERED: false,
    };
    // Strip nulls — Brevo accepts them but they clutter the contact panel.
    for (const k of Object.keys(attributes)) {
      if (attributes[k] === null || attributes[k] === undefined) {
        delete attributes[k];
      }
    }
    await this.brevo.upsertContact({
      email: lead.email,
      attributes,
      listIds: this.brevoListId ? [this.brevoListId] : [],
    });

    // Send the PDF email. Prefer an admin-managed Brevo template if one is
    // configured — otherwise fall back to a simple inline HTML email so this
    // works out of the box.
    const downloadUrl = `${this.siteUrl}/lead-magnet/${magnetSlug}`;
    if (this.brevoTemplateId) {
      await this.brevo.sendTransactional({
        to: { email: lead.email, name: lead.name ?? undefined },
        templateId: this.brevoTemplateId,
        params: {
          firstName: attributes.FIRSTNAME ?? '',
          magnetSlug,
          downloadUrl,
          siteUrl: this.siteUrl,
        },
        tags: ['lead-magnet', `magnet:${magnetSlug}`],
      });
    } else {
      const firstName = (attributes.FIRSTNAME as string | undefined) ?? '';
      await this.brevo.sendTransactional({
        to: { email: lead.email, name: lead.name ?? undefined },
        subject: 'Your free chapter — NSE Academy',
        htmlContent: this.renderDefaultMagnetEmail(firstName, downloadUrl),
        textContent: this.renderDefaultMagnetEmailText(firstName, downloadUrl),
        tags: ['lead-magnet', `magnet:${magnetSlug}`],
      });
    }
  }

  private renderDefaultMagnetEmail(firstName: string, downloadUrl: string): string {
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
  <h1 style="font-size: 22px; margin: 0 0 12px;">${greeting}</h1>
  <p style="font-size: 16px; line-height: 1.6;">
    Thanks for grabbing the free chapter of the <strong>Complete NSE Investor's Guide</strong>.
    Here's your download link:
  </p>
  <p style="margin: 28px 0;">
    <a href="${downloadUrl}"
       style="display: inline-block; background: #047857; color: #fff; text-decoration: none;
              font-weight: 600; padding: 14px 28px; border-radius: 12px;">
      Download the chapter
    </a>
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #52525b;">
    Over the next few days we'll send you a short series with what we wish every Kenyan
    investor knew before their first NSE trade — how CDS accounts work, which brokers to
    consider, and how to read company filings.
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #52525b;">
    Reply to this email if you have any questions. We read every one.
  </p>
  <p style="font-size: 14px; color: #52525b; margin-top: 32px;">
    — The NSE Academy team<br/>
    <a href="${this.siteUrl}" style="color: #047857;">${this.siteUrl.replace(/^https?:\/\//, '')}</a>
  </p>
</body></html>`;
  }

  private renderDefaultMagnetEmailText(
    firstName: string,
    downloadUrl: string,
  ): string {
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    return `${greeting}

Thanks for grabbing the free chapter of the Complete NSE Investor's Guide.

Download: ${downloadUrl}

Over the next few days we'll send you a short series with what we wish every
Kenyan investor knew before their first NSE trade — how CDS accounts work,
which brokers to consider, and how to read company filings.

Reply to this email if you have any questions. We read every one.

— The NSE Academy team
${this.siteUrl}
`;
  }

  /**
   * Mark a lead as converted (the user later registered for an account).
   * Called from AuthService.register(). Updates the Brevo contact too so
   * any welcome drip can branch on REGISTERED=true.
   */
  async markConverted(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const updated = await this.prisma.lead.updateMany({
      where: { email: normalized, convertedAt: null },
      data: { convertedAt: new Date() },
    });
    if (updated.count === 0) return; // not a previously-captured lead
    void this.brevo.updateContact(normalized, {
      REGISTERED: true,
      REGISTERED_AT: new Date().toISOString(),
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

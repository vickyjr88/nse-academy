import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminNotifierService } from '../admin-notifier/admin-notifier.service';
import { escapeHtml } from '../brevo/email-template';
import { quoteBlock } from '../brevo/email-blocks';

/** A sender past this many messages in an hour is still saved, but stops triggering alert emails. */
export const MAX_ALERTS_PER_SENDER_PER_HOUR = 3;
/** Hard ceiling on contact alert emails per hour overall - protects the Brevo daily quota from a bot flood. */
export const MAX_ALERTS_PER_HOUR = 20;

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private alertTimestamps: number[] = [];

  constructor(
    private prisma: PrismaService,
    private adminNotifier: AdminNotifierService,
  ) {}

  async create(dto: { name: string; email: string; subject: string; message: string; website?: string }) {
    // Honeypot: the form has a hidden "website" field no human fills in. Bots
    // fill every field, so a value here means a bot - answer with a normal
    // success so it learns nothing, but store nothing and alert nobody.
    if (dto.website) {
      this.logger.warn(`Honeypot tripped by ${dto.email} - submission dropped`);
      return { received: true };
    }
    if (!dto.name || !dto.email || !dto.subject || !dto.message) {
      throw new BadRequestException('All fields are required');
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const fromSenderLastHour = await this.prisma.contactSubmission.count({
      where: { email: dto.email, createdAt: { gte: hourAgo } },
    });

    const submission = await this.prisma.contactSubmission.create({
      data: { name: dto.name, email: dto.email, subject: dto.subject, message: dto.message },
    });

    // The submission is always saved (visible in the admin, counted in the
    // daily report); only the real-time email is rate limited.
    if (fromSenderLastHour < MAX_ALERTS_PER_SENDER_PER_HOUR && this.takeAlertSlot()) {
      void this.alertAdmin(submission);
    } else {
      this.logger.warn(`Contact alert suppressed (rate limit) for ${dto.email}`);
    }
    return submission;
  }

  private takeAlertSlot(): boolean {
    const cutoff = Date.now() - 60 * 60 * 1000;
    this.alertTimestamps = this.alertTimestamps.filter((t) => t > cutoff);
    if (this.alertTimestamps.length >= MAX_ALERTS_PER_HOUR) return false;
    this.alertTimestamps.push(Date.now());
    return true;
  }

  private async alertAdmin(s: { id: string; name: string; email: string; subject: string; message: string }) {
    await this.adminNotifier.notify({
      subject: `New contact message: ${s.subject}`.slice(0, 150),
      eyebrow: 'New Message',
      heading: `New contact message from ${s.name}`,
      bodyHtml: [`<strong>${escapeHtml(s.subject)}</strong><br><span style="color:#52525b;font-size:14px;">${escapeHtml(s.name)} &lt;${escapeHtml(s.email)}&gt;</span>`],
      rawHtml: quoteBlock(s.message),
      bodyText: [`From: ${s.name} <${s.email}>`, `Subject: ${s.subject}`, '', s.message],
      button: { label: 'Open in admin', url: this.adminNotifier.adminUrl(`contact-submissions/${s.id}`) },
      replyTo: { email: s.email, name: s.name },
      tags: ['contact-message'],
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [submissions, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contactSubmission.count(),
    ]);
    return { submissions, total, pageCount: Math.ceil(total / limit) };
  }

  async markRead(id: string) {
    return this.prisma.contactSubmission.update({
      where: { id },
      data: { status: 'read' },
    });
  }

  async markReplied(id: string) {
    return this.prisma.contactSubmission.update({
      where: { id },
      data: { status: 'replied' },
    });
  }

  async countNew() {
    return this.prisma.contactSubmission.count({ where: { status: 'new' } });
  }
}

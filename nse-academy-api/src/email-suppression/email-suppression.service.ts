import { Injectable, Logger } from '@nestjs/common';
import { promises as dns } from 'dns';
import { PrismaService } from '../prisma/prisma.service';
import { DISPOSABLE_DOMAINS } from '../brevo/deliverability';

export type SuppressionReason = 'hard_bounce' | 'blocked' | 'spam' | 'unsubscribed' | 'invalid_email' | 'manual';

/** Brevo transactional webhook event names that mean "stop sending to this address", and what we record. */
export const SUPPRESSING_EVENTS: Record<string, SuppressionReason> = {
  hard_bounce: 'hard_bounce',
  hardBounce: 'hard_bounce',
  blocked: 'blocked',
  spam: 'spam',
  unsubscribed: 'unsubscribed',
  unsubscription: 'unsubscribed',
  invalid_email: 'invalid_email',
  invalid: 'invalid_email',
};

export type SendVerdict = { send: true } | { send: false; reason: string };

const SYNTAX = /^[^@\s]+@([^@\s]+\.[^@\s]+)$/;
const DNS_TTL_MS = 24 * 3_600_000;
/** Resolver error codes that mean the domain really has no mail server; anything else (a timeout, a SERVFAIL) is not proof. */
const NO_MAIL = new Set(['ENOTFOUND', 'ENODATA']);

@Injectable()
export class EmailSuppressionService {
  private readonly logger = new Logger(EmailSuppressionService.name);
  private readonly dnsCache = new Map<string, { at: number; hasMail: boolean }>();

  constructor(private prisma: PrismaService) {}

  private norm(email: string): string {
    return email.trim().toLowerCase();
  }

  async isSuppressed(email: string): Promise<boolean> {
    try {
      return !!(await this.prisma.emailSuppression.findUnique({ where: { email: this.norm(email) }, select: { email: true } }));
    } catch {
      return false; // never let a lookup problem stop mail that should go
    }
  }

  async suppress(email: string, reason: SuppressionReason): Promise<void> {
    const e = this.norm(email);
    if (!SYNTAX.test(e)) return;
    await this.prisma.emailSuppression.upsert({ where: { email: e }, create: { email: e, reason }, update: { reason } });
  }

  async release(email: string): Promise<boolean> {
    const r = await this.prisma.emailSuppression.deleteMany({ where: { email: this.norm(email) } });
    return r.count > 0;
  }

  async list(limit = 200) {
    return this.prisma.emailSuppression.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 1000) });
  }

  private async domainHasMail(domain: string): Promise<boolean> {
    const hit = this.dnsCache.get(domain);
    if (hit && Date.now() - hit.at < DNS_TTL_MS) return hit.hasMail;
    try {
      const mx = await dns.resolveMx(domain);
      const hasMail = mx.length > 0;
      this.dnsCache.set(domain, { at: Date.now(), hasMail });
      return hasMail;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code ?? '';
      if (NO_MAIL.has(code)) {
        this.dnsCache.set(domain, { at: Date.now(), hasMail: false });
        return false;
      }
      this.logger.warn(`Could not check the mail server of ${domain} (${code || (err as Error).message}); sending anyway`);
      return true;
    }
  }

  /** Whether an address is worth mailing: well formed, not a throwaway domain, not suppressed, and its domain takes mail. */
  async verdict(email: string): Promise<SendVerdict> {
    const e = this.norm(email);
    const m = SYNTAX.exec(e);
    if (!m) return { send: false, reason: 'not a valid address' };
    const domain = m[1];
    if (DISPOSABLE_DOMAINS.has(domain)) return { send: false, reason: 'throwaway-mail domain' };
    if (await this.isSuppressed(e)) return { send: false, reason: 'address is suppressed (bounced, blocked or unsubscribed)' };
    if (!(await this.domainHasMail(domain))) return { send: false, reason: 'domain has no mail server' };
    return { send: true };
  }
}

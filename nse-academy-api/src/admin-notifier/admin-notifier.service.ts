import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoService } from '../brevo/brevo.service';
import { EmailButton, escapeHtml, renderEmailHtml, renderEmailText } from '../brevo/email-template';

export const DEFAULT_ADMIN_NOTIFY_EMAIL = 'info@vitaldigitalmedia.net';

export interface AdminAlertInput {
  subject: string;
  /** Short uppercase label above the heading, e.g. "New Message". */
  eyebrow: string;
  heading: string;
  /** Inline-HTML paragraphs. Escape any user-supplied text first. */
  bodyHtml?: string[];
  /** Plain-text counterparts of bodyHtml (and rawHtml) for the text part. */
  bodyText: string[];
  rawHtml?: string;
  infoBox?: string;
  button?: EmailButton;
  /** Reply goes here instead of the no-reply sender (e.g. the person who wrote in). */
  replyTo?: { email: string; name?: string };
  tags?: string[];
  /** Overrides the configured recipients - used for test sends. */
  to?: string[];
}

/**
 * Single place that emails the platform admin(s). Real-time alerts (a new
 * contact message, a payment, a failed webhook) and the daily report all go
 * through here so they share recipients, branding, and failure handling.
 *
 * notify() never throws: an alert is a side effect of someone else's request
 * (a customer paying, a visitor writing in) and must never break it.
 */
@Injectable()
export class AdminNotifierService {
  private readonly logger = new Logger(AdminNotifierService.name);
  private readonly recentKeys = new Map<string, number>();

  constructor(
    private brevo: BrevoService,
    private config: ConfigService,
  ) {}

  /** ADMIN_NOTIFY_EMAIL may hold several comma-separated addresses. */
  recipients(): string[] {
    const raw = this.config.get<string>('ADMIN_NOTIFY_EMAIL') || DEFAULT_ADMIN_NOTIFY_EMAIL;
    return raw
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));
  }

  siteUrl(): string {
    return (
      this.config.get<string>('WEB_URL') ||
      this.config.get<string>('SITE_URL') ||
      'https://nseacademy.vitaldigitalmedia.net'
    );
  }

  /** Deep link into the Strapi admin's user-manager plugin, e.g. adminUrl('contact-submissions/abc'). */
  adminUrl(path = ''): string {
    const base = (this.config.get<string>('CMS_ADMIN_URL') || 'https://nseacademy-admin.vitaldigitalmedia.net').replace(/\/$/, '');
    return `${base}/admin/plugins/user-manager${path ? `/${path}` : ''}`;
  }

  async notify(input: AdminAlertInput): Promise<void> {
    const to = input.to?.length ? input.to : this.recipients();
    const siteUrl = this.siteUrl();
    const htmlContent = renderEmailHtml({
      eyebrow: input.eyebrow,
      heading: input.heading,
      bodyHtml: input.bodyHtml ?? [],
      rawHtml: input.rawHtml,
      infoBox: input.infoBox,
      button: input.button,
      siteUrl,
    });
    const textContent = renderEmailText({
      heading: input.heading,
      bodyText: input.bodyText,
      button: input.button,
      siteUrl,
    });
    for (const email of to) {
      try {
        await this.brevo.sendTransactional({
          to: { email },
          subject: input.subject,
          htmlContent,
          textContent,
          replyTo: input.replyTo,
          tags: ['admin-alert', ...(input.tags ?? [])],
          ignoreSuppression: true,
        });
      } catch (err) {
        this.logger.error(`Admin alert "${input.subject}" to ${email} failed: ${(err as Error).message}`);
      }
    }
  }

  /**
   * notify(), but at most once per `key` within `ttlMs`. For events that
   * repeat on their own - Paystack retries a failed webhook for hours, and
   * each retry would otherwise send the same alert again.
   */
  async notifyOnce(key: string, ttlMs: number, input: AdminAlertInput): Promise<boolean> {
    const now = Date.now();
    for (const [k, at] of this.recentKeys) {
      if (now - at > ttlMs) this.recentKeys.delete(k);
    }
    if (this.recentKeys.has(key)) return false;
    this.recentKeys.set(key, now);
    await this.notify(input);
    return true;
  }

  // ---- Purpose-built alerts: one line at the call site, consistent wording ----

  /** A customer paid (subscription, ebook or corporate license). */
  async paymentReceived(p: {
    kind: 'Subscription' | 'Ebook' | 'Corporate license';
    summary: string;
    customer: string;
    amountKes: number;
    reference?: string;
    adminPath?: string;
  }): Promise<void> {
    const amount = `KSh ${p.amountKes.toLocaleString('en-KE')}`;
    await this.notify({
      subject: `Payment received: ${amount} - ${p.summary}`,
      eyebrow: 'Payment Received',
      heading: `${amount} - ${p.summary}`,
      bodyHtml: [`<strong>${escapeHtml(p.customer)}</strong> just paid for a ${p.kind.toLowerCase()}.`],
      infoBox: `${escapeHtml(p.kind)} &middot; <strong>${amount}</strong>${p.reference ? ` &middot; Ref ${escapeHtml(p.reference)}` : ''}`,
      bodyText: [`${p.customer} just paid for a ${p.kind.toLowerCase()}.`, `${p.summary} - ${amount}${p.reference ? ` (ref ${p.reference})` : ''}`],
      button: p.adminPath ? { label: 'Open in admin', url: this.adminUrl(p.adminPath) } : undefined,
      tags: ['payment-received'],
    });
  }

  /** Someone applied to become a financial advisor and is waiting for approval. */
  async advisorApplied(p: { name: string; email: string; headline: string; specialties: string[] }): Promise<void> {
    await this.notify({
      subject: `New advisor application: ${p.name}`,
      eyebrow: 'Needs Approval',
      heading: `${p.name} applied to be an advisor`,
      bodyHtml: [
        `<strong>${escapeHtml(p.headline)}</strong><br><span style="color:#52525b;font-size:14px;">${escapeHtml(p.name)} &lt;${escapeHtml(p.email)}&gt;${p.specialties.length ? ` &middot; ${escapeHtml(p.specialties.join(', '))}` : ''}</span>`,
        'They stay hidden from clients until you approve the application.',
      ],
      bodyText: [`${p.name} <${p.email}> applied to be an advisor.`, `Headline: ${p.headline}`, 'They stay hidden from clients until you approve.'],
      button: { label: 'Review applications', url: this.adminUrl('advisor-approvals') },
      tags: ['advisor-application'],
    });
  }

  async organizationCreated(p: { id: string; name: string; type: string; email: string }): Promise<void> {
    await this.notify({
      subject: `New organization: ${p.name}`,
      eyebrow: 'New Organization',
      heading: `${p.name} signed up`,
      bodyHtml: [`A new ${escapeHtml(p.type)} organization was created. It has no license until it pays or you set one up.`],
      infoBox: `${escapeHtml(p.name)} &middot; ${escapeHtml(p.email)}`,
      bodyText: [`New ${p.type} organization: ${p.name} <${p.email}>. No license yet.`],
      button: { label: 'Open organization', url: this.adminUrl(`organizations/${p.id}`) },
      tags: ['organization-created'],
    });
  }

  /**
   * Paystack confirmed a payment but we failed to apply it - the customer paid
   * and got nothing. Deduped per reference: Paystack retries for hours.
   */
  async webhookFailed(p: { reference?: string; event?: string; error: string }): Promise<void> {
    await this.notifyOnce(`webhook:${p.reference ?? p.event ?? 'unknown'}`, 30 * 60 * 1000, {
      subject: 'ACTION NEEDED: a payment was received but failed to process',
      eyebrow: 'Payment Problem',
      heading: 'A payment webhook failed to process',
      bodyHtml: [
        'Paystack reported a successful payment, but the API could not apply it. The customer may have paid without getting access. Paystack will retry automatically, so this may resolve itself - if it does not, activate it manually.',
      ],
      infoBox: `Event: <strong>${escapeHtml(p.event ?? 'unknown')}</strong> &middot; Reference: <strong>${escapeHtml(p.reference ?? 'unknown')}</strong><br>Error: ${escapeHtml(p.error.slice(0, 300))}`,
      bodyText: [
        'Paystack reported a successful payment but the API could not apply it. The customer may have paid without getting access. Paystack retries automatically.',
        `Event: ${p.event ?? 'unknown'}  Reference: ${p.reference ?? 'unknown'}`,
        `Error: ${p.error.slice(0, 300)}`,
      ],
      tags: ['webhook-failed'],
    });
  }
}

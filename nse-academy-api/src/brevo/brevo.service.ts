import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin HTTP wrapper over the Brevo (formerly Sendinblue) v3 REST API. We
 * deliberately avoid the SDK to keep the dependency surface tiny — Node 22
 * fetch handles the few calls we need.
 *
 * Every method silently no-ops with a single warning when BREVO_API_KEY is
 * missing, so local dev and CI work without a Brevo account. Errors during
 * sync are logged but never thrown — analytics must not break the user flow.
 */

const BASE_URL = 'https://api.brevo.com/v3';

export interface BrevoContactInput {
  email: string;
  attributes?: Record<string, unknown>;
  listIds?: number[];
}

export interface BrevoTransactionalEmailInput {
  to: { email: string; name?: string };
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  /** When set, Brevo uses the template + params and ignores subject/html/text. */
  templateId?: number;
  params?: Record<string, unknown>;
  /** Optional sender override; defaults to BREVO_SENDER_EMAIL/NAME. */
  sender?: { email: string; name?: string };
  /** Optional tags Brevo indexes for analytics. */
  tags?: string[];
}

@Injectable()
export class BrevoService {
  private readonly log = new Logger(BrevoService.name);
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private warnedMissingKey = false;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('BREVO_API_KEY') ?? '';
    this.senderEmail =
      this.config.get<string>('BREVO_SENDER_EMAIL') ??
      'no-reply@nseacademy.vitaldigitalmedia.net';
    this.senderName =
      this.config.get<string>('BREVO_SENDER_NAME') ?? 'NSE Academy';
  }

  hasCredentials(): boolean {
    return Boolean(this.apiKey);
  }

  private warnIfDisabled(): boolean {
    if (this.apiKey) return false;
    if (!this.warnedMissingKey) {
      this.warnedMissingKey = true;
      this.log.warn(
        'BREVO_API_KEY is not set — Brevo sync + transactional emails are disabled. ' +
          'Set BREVO_API_KEY in the API env to enable.',
      );
    }
    return true;
  }

  /**
   * Create or update a contact in Brevo. Idempotent via updateEnabled.
   */
  async upsertContact(input: BrevoContactInput): Promise<void> {
    if (this.warnIfDisabled()) return;
    const body = {
      email: input.email.toLowerCase(),
      attributes: input.attributes ?? {},
      listIds: input.listIds ?? [],
      updateEnabled: true,
    };
    try {
      await this.request('POST', '/contacts', body);
    } catch (err) {
      this.log.error(
        `Brevo upsertContact failed for ${input.email}: ${
          (err as Error).message
        }`,
      );
    }
  }

  /**
   * Update a contact's attributes only (no list changes). Use for marking
   * conversions, subscription_tier changes, etc.
   */
  async updateContact(
    email: string,
    attributes: Record<string, unknown>,
  ): Promise<void> {
    if (this.warnIfDisabled()) return;
    try {
      await this.request(
        'PUT',
        `/contacts/${encodeURIComponent(email.toLowerCase())}`,
        { attributes },
      );
    } catch (err) {
      // 404 on a missing contact is fine — they just never opted in. Warn.
      this.log.warn(
        `Brevo updateContact failed for ${email}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Send a transactional email. Uses BREVO_SENDER_EMAIL/NAME as the from
   * address unless overridden.
   */
  async sendTransactional(
    input: BrevoTransactionalEmailInput,
  ): Promise<void> {
    if (this.warnIfDisabled()) return;
    const sender = input.sender ?? {
      email: this.senderEmail,
      name: this.senderName,
    };
    const body: Record<string, unknown> = {
      sender,
      to: [input.to],
    };
    if (input.templateId) {
      body.templateId = input.templateId;
      if (input.params) body.params = input.params;
    } else {
      if (input.subject) body.subject = input.subject;
      if (input.htmlContent) body.htmlContent = input.htmlContent;
      if (input.textContent) body.textContent = input.textContent;
    }
    if (input.tags?.length) body.tags = input.tags;
    try {
      await this.request('POST', '/smtp/email', body);
    } catch (err) {
      this.log.error(
        `Brevo sendTransactional failed for ${input.to.email}: ${
          (err as Error).message
        }`,
      );
    }
  }

  private async request<T = unknown>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T | null> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    if (!res.ok) {
      let detail = '';
      try {
        const json = await res.json();
        detail = json?.message || JSON.stringify(json);
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`HTTP ${res.status}: ${detail}`);
    }
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
}

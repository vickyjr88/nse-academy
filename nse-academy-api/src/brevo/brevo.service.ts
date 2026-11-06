import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin HTTP wrapper over the Brevo (formerly Sendinblue) v3 REST API. We
 * deliberately avoid the SDK to keep the dependency surface tiny - Node 22
 * fetch handles the few calls we need.
 *
 * Every method silently no-ops with a single warning when BREVO_API_KEY is
 * missing, so local dev and CI work without a Brevo account. Errors during
 * sync are logged but never thrown - analytics must not break the user flow.
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
  /** Where a reply goes - lets an admin answer a contact message by hitting Reply. */
  replyTo?: { email: string; name?: string };
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
        'BREVO_API_KEY is not set - Brevo sync + transactional emails are disabled. ' +
          'Set BREVO_API_KEY in the API env to enable.',
      );
    }
    return true;
  }

  /**
   * Create or update a contact in Brevo. Idempotent via updateEnabled.
   * Returns whether the upsert actually succeeded so bulk callers can tell
   * a real sync from a silently-swallowed failure - existing callers that
   * only `await` this and ignore the result are unaffected.
   */
  async upsertContact(input: BrevoContactInput): Promise<boolean> {
    if (this.warnIfDisabled()) return false;
    const body = {
      email: input.email.toLowerCase(),
      attributes: input.attributes ?? {},
      listIds: input.listIds ?? [],
      updateEnabled: true,
    };
    try {
      await this.request('POST', '/contacts', body);
      return true;
    } catch (err) {
      this.log.error(
        `Brevo upsertContact failed for ${input.email}: ${
          (err as Error).message
        }`,
      );
      return false;
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
      // 404 on a missing contact is fine - they just never opted in. Warn.
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
    if (input.replyTo) body.replyTo = input.replyTo;
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

  /**
   * Create a Brevo email campaign targeting one or more contact lists.
   * Unlike the other methods here, this throws on failure rather than
   * swallowing errors - the broadcast feature needs to know a send actually
   * worked before reporting success to an admin sending to real users.
   */
  async createCampaign(input: {
    name: string;
    subject: string;
    htmlContent: string;
    listIds: number[];
    /** UTC ISO timestamp. When set, Brevo itself sends the campaign then (no sendNow call is needed). */
    scheduledAt?: string;
  }): Promise<{ id: number }> {
    if (!this.apiKey) {
      throw new Error('BREVO_API_KEY is not set - cannot create a campaign');
    }
    const result = await this.request<{ id: number }>('POST', '/emailCampaigns', {
      name: input.name,
      subject: input.subject,
      htmlContent: input.htmlContent,
      sender: { email: this.senderEmail, name: this.senderName },
      recipients: { listIds: input.listIds },
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
    });
    if (!result?.id) {
      throw new Error('Brevo did not return a campaign id');
    }
    return result;
  }

  async getList(listId: number): Promise<{ id: number; name: string; folderId: number; totalSubscribers: number } | null> {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set');
    return this.request('GET', `/contacts/lists/${listId}`);
  }

  /**
   * Finds a contact list by exact name, or creates it in `folderId`. Lets a feature own a list that no other
   * broadcast touches - a scheduled campaign reads its list when it sends, so a shared list would change its audience.
   */
  async findOrCreateList(name: string, folderId: number): Promise<number> {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set');
    for (let offset = 0; offset < 1000; offset += 50) {
      const page = await this.request<{ lists?: { id: number; name: string }[] }>('GET', `/contacts/lists?limit=50&offset=${offset}`);
      const lists = page?.lists ?? [];
      const hit = lists.find((l) => l.name === name);
      if (hit) return hit.id;
      if (lists.length < 50) break;
    }
    const created = await this.request<{ id: number }>('POST', '/contacts/lists', { name, folderId });
    if (!created?.id) throw new Error('Brevo did not return a list id');
    return created.id;
  }

  /**
   * Removes every contact from a list (the contacts themselves are kept). Brevo rejects the `{ all: true }` form of its
   * remove call with HTTP 400, so this reads the members and removes them explicitly, 150 at a time (Brevo's limit).
   */
  async clearList(listId: number): Promise<void> {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set');
    for (let round = 0; round < 50; round++) {
      const page = await this.request<{ contacts?: { email: string }[] }>('GET', `/contacts/lists/${listId}/contacts?limit=500&offset=0`);
      const emails = (page?.contacts ?? []).map((c) => c.email);
      if (emails.length === 0) return;
      for (let i = 0; i < emails.length; i += 150) {
        await this.request('POST', `/contacts/lists/${listId}/contacts/remove`, { emails: emails.slice(i, i + 150) });
      }
    }
    throw new Error(`Brevo list ${listId} still has contacts after 50 rounds of removal`);
  }

  async getCampaign(campaignId: number): Promise<{ id: number; name: string; status: string; scheduledAt?: string; htmlContent?: string; recipients?: unknown } | null> {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set');
    return this.request('GET', `/emailCampaigns/${campaignId}`);
  }

  /** Sends a rendered copy of a real campaign to a few addresses, exactly as recipients will get it. */
  async sendCampaignTest(campaignId: number, emails: string[]): Promise<void> {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set');
    await this.request('POST', `/emailCampaigns/${campaignId}/sendTest`, { emailTo: emails });
  }

  /** Deletes a campaign (works while it is still scheduled, which cancels the send). */
  async deleteCampaign(campaignId: number): Promise<void> {
    if (!this.apiKey) throw new Error('BREVO_API_KEY is not set');
    await this.request('DELETE', `/emailCampaigns/${campaignId}`);
  }

  /** Triggers immediate sending of a previously created campaign. */
  async sendCampaignNow(campaignId: number): Promise<void> {
    if (!this.apiKey) {
      throw new Error('BREVO_API_KEY is not set - cannot send a campaign');
    }
    await this.request('POST', `/emailCampaigns/${campaignId}/sendNow`);
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

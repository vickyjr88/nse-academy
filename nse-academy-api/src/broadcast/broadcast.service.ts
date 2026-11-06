import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { Resolver, hasMailServer, screenAddresses } from '../brevo/deliverability';
import { ComposeBroadcastDto } from './dto/compose-broadcast.dto';

// Brevo rate-limits bursts of contact writes: ten at once dropped a third of an audience in practice.
const SYNC_CONCURRENCY = 5;
const SYNC_RETRIES = 3;
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Brevo adds its own working unsubscribe link wherever one of these appears. */
const UNSUBSCRIBE_TAG = /\{\{\s*unsubscribe\s*\}\}|\[UNSUBSCRIBE\]/i;

/** A message must always carry an unsubscribe link; if the author left it out, add a plain footer. */
export function ensureUnsubscribeLink(html: string): string {
  if (UNSUBSCRIBE_TAG.test(html)) return html;
  const footer = '<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a;font-family:Arial,Helvetica,sans-serif;">You are receiving this because you have an NSE Academy account. <a href="{{ unsubscribe }}" style="color:#71717a;">Unsubscribe</a></p>';
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${footer}</body>`) : `${html}\n${footer}`;
}

export interface PreparedList {
  listId: number;
  /** Contacts actually on the list - the people the campaign will go to (Brevo still skips anyone it has blocklisted). */
  audienceCount: number;
  /** Contacts Brevo would not take even after retries. */
  failed: string[];
  /** Users left out because their address cannot receive mail. */
  excluded: { email: string; reason: string }[];
}

type Tier = 'free' | 'intermediary' | 'premium';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
    private readonly config: ConfigService,
  ) {}

  /** Whether a domain can receive mail. A field so tests can replace it. */
  resolveMx: Resolver = hasMailServer;
  /** Pause between contact-upload retries. A field so tests can set it to 0. */
  retryDelayMs = 800;

  private audienceWhere(tier?: Tier, tagId?: string) {
    const clauses: Record<string, unknown>[] = [];
    if (tier) {
      if (tier === 'free') {
        // A user with no Subscription row at all is free tier by definition
        // (see deriveEffectiveTier) - without this, "free" would only match
        // users who happen to have an explicit tier='free' row, missing most
        // of the actual free-tier user base.
        clauses.push({ OR: [{ subscription: null }, { subscription: { tier: 'free' } }] });
      } else {
        clauses.push({ subscription: { tier } });
      }
    }
    // Tag is an additive AND filter on top of tier, not a replacement for
    // it - e.g. "free tier AND tagged engaged-free" narrows the tier
    // audience further rather than picking one or the other.
    if (tagId) {
      clauses.push({ tags: { some: { tagId } } });
    }
    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return { AND: clauses };
  }

  /** Everyone a broadcast to this audience would reach, before address screening. */
  listAudience(tier?: Tier, tagId?: string): Promise<{ email: string; name: string }[]> {
    return this.prisma.user.findMany({
      where: this.audienceWhere(tier, tagId),
      select: { email: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** "all", "tier:free", "tag:abc", "tier:free+tag:abc": one Brevo list per distinct audience. */
  audienceKey(tier?: Tier, tagId?: string): string {
    const parts = [tier ? `tier:${tier}` : '', tagId ? `tag:${tagId}` : ''].filter(Boolean);
    return parts.length ? parts.join('+') : 'all';
  }

  /** `count` is who will actually be mailed; `skipped` are users whose address cannot receive mail. */
  async getAudiencePreview(tier?: Tier, tagId?: string): Promise<{ count: number; skipped: number; total: number }> {
    const users = await this.listAudience(tier, tagId);
    const { deliverable } = await screenAddresses(users, this.resolveMx);
    return { count: deliverable.length, skipped: users.length - deliverable.length, total: users.length };
  }

  /**
   * Fills a Brevo list that belongs to ONE audience with exactly these users. The list is created next to
   * BREVO_BROADCAST_LIST_ID if it does not exist and emptied first if it does, so a send can only reach the people it
   * was meant for - the previous design synced every audience into one shared list that was never emptied, so a later
   * send to a smaller group also reached everyone synced before it. Undeliverable addresses are left out, and contacts
   * Brevo rate-limits are retried one at a time instead of being dropped.
   */
  async prepareAudienceList(listName: string, users: { email: string; name: string }[]): Promise<PreparedList> {
    const baseListId = parseInt(this.config.get<string>('BREVO_BROADCAST_LIST_ID') ?? '', 10);
    if (!baseListId || Number.isNaN(baseListId)) {
      throw new BadRequestException(
        'BREVO_BROADCAST_LIST_ID is not configured - create a list in Brevo and set its id in the API env',
      );
    }
    const folder = await this.brevo.getList(baseListId);
    if (!folder) throw new BadRequestException(`Brevo list ${baseListId} was not found`);

    const { deliverable, excluded } = await screenAddresses(users, this.resolveMx);
    if (deliverable.length === 0) {
      throw new BadRequestException(
        users.length === 0 ? 'No users match this audience - nothing to send' : 'No user in this audience has a deliverable email address - nothing to send',
      );
    }

    const listId = await this.brevo.findOrCreateList(listName, folder.folderId);
    const existing = await this.brevo.getList(listId);
    if (existing && existing.totalSubscribers > 0) await this.brevo.clearList(listId);

    const add = (u: { email: string; name: string }) => this.brevo.upsertContact({ email: u.email, attributes: { FIRSTNAME: u.name }, listIds: [listId] });
    let failedUsers: { email: string; name: string }[] = [];
    for (let i = 0; i < deliverable.length; i += SYNC_CONCURRENCY) {
      const batch = deliverable.slice(i, i + SYNC_CONCURRENCY);
      const results = await Promise.all(batch.map((u) => add(u).then((ok) => ({ u, ok }))));
      failedUsers.push(...results.filter((r) => !r.ok).map((r) => r.u));
    }
    for (let attempt = 1; attempt <= SYNC_RETRIES && failedUsers.length > 0; attempt++) {
      const stillFailing: typeof failedUsers = [];
      for (const u of failedUsers) {
        await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt));
        if (!(await add(u))) stillFailing.push(u);
      }
      failedUsers = stillFailing;
    }

    const failed = failedUsers.map((u) => u.email);
    const audienceCount = deliverable.length - failed.length;
    if (audienceCount === 0) {
      throw new BadRequestException(`Could not add any user to the Brevo list - all ${failed.length} attempts failed. Check BREVO_API_KEY and server logs.`);
    }
    if (failed.length > 0) {
      this.logger.warn(`${failed.length} user(s) could not be added to Brevo list ${listId} and will NOT receive this send: ${failed.join(', ')}`);
    }
    return { listId, audienceCount, failed, excluded };
  }

  async composeAndSend(dto: ComposeBroadcastDto & { force?: boolean }): Promise<{
    campaignId: number;
    audienceCount: number;
    failedCount: number;
    failedEmails: string[];
    excluded: { email: string; reason: string }[];
  }> {
    const htmlContent = ensureUnsubscribeLink(dto.htmlContent);
    const tier = dto.tier;
    const tagId = dto.tagId || undefined;

    if (!dto.force) {
      const dup = await this.prisma.broadcastCampaign.findFirst({
        where: { subject: dto.subject, tier: tier ?? null, tagId: tagId ?? null, createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
        select: { brevoCampaignId: true },
      });
      if (dup) {
        throw new BadRequestException(
          `A broadcast with this subject was already sent to this audience in the last 24 hours (Brevo campaign ${dup.brevoCampaignId}). If you really mean to send it again, pass force: true.`,
        );
      }
    }

    const users = await this.listAudience(tier, tagId);
    const prepared = await this.prepareAudienceList(`NSE Academy broadcast - ${this.audienceKey(tier, tagId)}`, users);
    this.logger.log(`Prepared ${prepared.audienceCount} users on Brevo list ${prepared.listId} for a broadcast (${prepared.excluded.length} undeliverable skipped)`);

    try {
      const campaign = await this.brevo.createCampaign({
        name: `${dto.subject} - ${new Date().toISOString()}`,
        subject: dto.subject,
        htmlContent,
        listIds: [prepared.listId],
      });
      await this.brevo.sendCampaignNow(campaign.id);

      this.logger.log(`Sent broadcast campaign ${campaign.id} to ${prepared.audienceCount} users`);

      await this.prisma.broadcastCampaign.create({
        data: {
          brevoCampaignId: campaign.id,
          subject: dto.subject,
          htmlContent,
          tier: tier ?? null,
          tagId: tagId ?? null,
          audienceCount: prepared.audienceCount,
          failedCount: prepared.failed.length,
        },
      });

      return { campaignId: campaign.id, audienceCount: prepared.audienceCount, failedCount: prepared.failed.length, failedEmails: prepared.failed, excluded: prepared.excluded };
    } catch (err) {
      // Surface the real reason to the admin UI rather than a generic 500 -
      // the audience is already synced at this point, so this is almost
      // always a Brevo config issue (missing key, invalid list) worth acting on.
      throw new BadRequestException((err as Error).message || 'Failed to send broadcast via Brevo');
    }
  }

  async listCampaigns(params: { page: number; limit: number }) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.broadcastCampaign.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.broadcastCampaign.count(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

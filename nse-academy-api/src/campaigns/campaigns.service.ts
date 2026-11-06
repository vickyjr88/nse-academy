import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { BroadcastService } from '../broadcast/broadcast.service';
import { loadDailyCloses } from '../market-data/price-history';
import { EXAMPLE_POSITIONS, buildExampleWatch } from './example-watch';
import { Audience, buildSubscriptionEmail } from './subscription-email';
import { Resolver, hasMailServer, screenAddresses } from './deliverability';

export const AUDIENCES: Audience[] = ['free', 'intermediary', 'premium'];

/** Brevo's merge tag for a campaign's own unsubscribe link. */
const BREVO_UNSUBSCRIBE = '{{ unsubscribe }}';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private prisma: PrismaService,
    private brevo: BrevoService,
    private broadcast: BroadcastService,
    private config: ConfigService,
  ) {}

  /** Looks up whether a domain can receive mail. A field (not a constructor argument) so tests can replace it without touching DI. */
  resolveMx: Resolver = hasMailServer;

  /** Pause between retries when Brevo rate-limits the contact uploads. A field so tests can set it to 0. */
  retryDelayMs = 800;

  private siteUrl(): string {
    return this.config.get<string>('WEB_URL') || this.config.get<string>('SITE_URL') || 'https://nseacademy.vitaldigitalmedia.net';
  }

  /** The email for one audience, with the example portfolio computed from today's real closes. */
  async build(audience: Audience, opts: { sample?: boolean } = {}) {
    const series = await loadDailyCloses(this.prisma, EXAMPLE_POSITIONS.map((p) => p.ticker));
    const example = buildExampleWatch(series);
    if (!example) this.logger.warn('Marketing email built without the example portfolio: price history is missing for one of its stocks');
    return buildSubscriptionEmail({
      audience,
      siteUrl: this.siteUrl(),
      example,
      unsubscribeUrl: BREVO_UNSUBSCRIBE,
      sample: opts.sample,
    });
  }

  /** Review copies, sent as ordinary transactional mail to one address. Touches no user. */
  async sendSamples(to: string, audiences: Audience[] = AUDIENCES): Promise<{ to: string; sent: { audience: Audience; subject: string }[] }> {
    const sent: { audience: Audience; subject: string }[] = [];
    for (const [i, audience] of audiences.entries()) {
      const { subject, html, text } = await this.build(audience, { sample: true });
      await this.brevo.sendTransactional({
        to: { email: to },
        subject: `[SAMPLE ${i + 1}/${audiences.length} - ${audience}] ${subject}`,
        htmlContent: html,
        textContent: text,
        tags: ['marketing-sample'],
      });
      sent.push({ audience, subject });
    }
    return { to, sent };
  }

  /**
   * The real send: one Brevo campaign to every user on that plan tier, through the existing broadcast tool (which
   * syncs the audience to the Brevo list and lets Brevo handle unsubscribes and bounces). Needs explicit confirmation.
   */
  async sendCampaign(audience: Audience, confirm: boolean) {
    if (!confirm) throw new BadRequestException('Pass confirm: true to send this campaign to real users');
    const { subject, html } = await this.build(audience);
    return this.broadcast.composeAndSend({ subject, htmlContent: html, tier: audience });
  }

  /**
   * Schedules the campaign for one audience as a Brevo campaign that Brevo itself sends at `scheduledAt`.
   *  - Each audience has its own Brevo list. A campaign reads its list when it sends, so a list shared with other
   *    broadcasts could change who a scheduled campaign reaches.
   *  - Addresses that cannot receive mail (no mail server, throwaway domains) are left out.
   *  - Refuses to schedule the same subject for the same tier twice within a day unless `force` is set.
   * Returns what was scheduled, who was left out, and anyone Brevo would not accept.
   */
  async scheduleCampaign(audience: Audience, opts: { confirm: boolean; scheduledAt: string; force?: boolean }) {
    if (!opts.confirm) throw new BadRequestException('Pass confirm: true to schedule this campaign for real users');
    const when = new Date(opts.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new BadRequestException('scheduledAt must be an ISO timestamp, e.g. 2026-11-06T04:00:00Z');
    const lead = when.getTime() - Date.now();
    if (lead < 10 * 60_000) throw new BadRequestException('scheduledAt must be at least 10 minutes from now');
    if (lead > 30 * 24 * 3_600_000) throw new BadRequestException('scheduledAt must be within the next 30 days');

    const { subject, html } = await this.build(audience);

    if (!opts.force) {
      const dup = await this.prisma.broadcastCampaign.findFirst({
        where: { subject, tier: audience, createdAt: { gt: new Date(Date.now() - 24 * 3_600_000) } },
        select: { brevoCampaignId: true },
      });
      if (dup) throw new BadRequestException(`This campaign was already scheduled or sent for the ${audience} tier in the last 24 hours (Brevo campaign ${dup.brevoCampaignId}). Pass force: true to do it again.`);
    }

    const baseListId = parseInt(this.config.get<string>('BREVO_BROADCAST_LIST_ID') ?? '', 10);
    if (!baseListId) throw new BadRequestException('BREVO_BROADCAST_LIST_ID is not configured (it supplies the Brevo folder for the campaign lists)');
    const folder = await this.brevo.getList(baseListId);
    if (!folder) throw new BadRequestException(`Brevo list ${baseListId} was not found`);

    const listId = await this.brevo.findOrCreateList(`NSE Academy subscription campaign - ${audience}`, folder.folderId);
    const existing = await this.brevo.getList(listId);
    if (existing && existing.totalSubscribers > 0) await this.brevo.clearList(listId);

    const { deliverable, excluded } = await screenAddresses(await this.broadcast.listAudience(audience), this.resolveMx);
    if (deliverable.length === 0) throw new BadRequestException(`No deliverable users in the ${audience} audience - nothing to schedule`);

    // Brevo rate-limits bursts of contact writes (ten at once dropped a third of this audience in practice), so write in
    // small batches, then retry whatever failed one at a time with a growing pause before calling it a failure.
    const add = (u: { email: string; name: string }) => this.brevo.upsertContact({ email: u.email, attributes: { FIRSTNAME: u.name }, listIds: [listId] });
    let failedUsers: { email: string; name: string }[] = [];
    for (let i = 0; i < deliverable.length; i += 5) {
      const batch = deliverable.slice(i, i + 5);
      const results = await Promise.all(batch.map((u) => add(u).then((ok) => ({ u, ok }))));
      failedUsers.push(...results.filter((r) => !r.ok).map((r) => r.u));
    }
    for (let attempt = 1; attempt <= 3 && failedUsers.length > 0; attempt++) {
      const stillFailing: typeof failedUsers = [];
      for (const u of failedUsers) {
        await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt));
        if (!(await add(u))) stillFailing.push(u);
      }
      failedUsers = stillFailing;
    }
    const failed = failedUsers.map((u) => u.email);
    const audienceCount = deliverable.length - failed.length;
    if (audienceCount === 0) throw new BadRequestException('Could not add any user to the Brevo list - check BREVO_API_KEY and the logs');

    const scheduledAt = when.toISOString();
    const campaign = await this.brevo.createCampaign({
      name: `Subscription campaign - ${audience} - ${scheduledAt}`,
      subject,
      htmlContent: html,
      listIds: [listId],
      scheduledAt,
    });
    await this.prisma.broadcastCampaign.create({
      data: { brevoCampaignId: campaign.id, subject, htmlContent: html, tier: audience, audienceCount, failedCount: failed.length },
    });
    this.logger.log(`Scheduled Brevo campaign ${campaign.id} (${audience}, ${audienceCount} recipients) for ${scheduledAt}`);
    return { audience, campaignId: campaign.id, listId, scheduledAt, audienceCount, excluded, failed };
  }

  /** Sends a rendered copy of an already-created campaign to the given addresses, to see exactly what recipients get. */
  async testCampaign(campaignId: number, to: string[]) {
    await this.brevo.sendCampaignTest(campaignId, to);
    return { campaignId, to };
  }

  /** Cancels a scheduled campaign by deleting it in Brevo. */
  async cancelCampaign(campaignId: number) {
    await this.brevo.deleteCampaign(campaignId);
    return { campaignId, cancelled: true };
  }
}

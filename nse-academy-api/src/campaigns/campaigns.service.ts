import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { BroadcastService } from '../broadcast/broadcast.service';
import { loadDailyCloses } from '../market-data/price-history';
import { EXAMPLE_POSITIONS, PublicExample, buildExampleWatch, toPublicExample } from './example-watch';
import { Audience, buildSubscriptionEmail, subscriptionSubject } from './subscription-email';

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

  private siteUrl(): string {
    return this.config.get<string>('WEB_URL') || this.config.get<string>('SITE_URL') || 'https://nseacademy.vitaldigitalmedia.net';
  }

  /** The example portfolio for the public website, on the latest real closes. 404 when the price history is incomplete. */
  async publicExample(): Promise<PublicExample> {
    const series = await loadDailyCloses(this.prisma, EXAMPLE_POSITIONS.map((p) => p.ticker));
    const example = buildExampleWatch(series);
    if (!example) throw new NotFoundException('The example portfolio is not available right now');
    return toPublicExample(example);
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
   *  - Each audience has its own Brevo list (a campaign reads its list when it sends), prepared by BroadcastService.
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

    // The audience list is prepared (own list, emptied first, undeliverable addresses left out, rate-limited contacts
    // retried) by the same code the broadcast tool uses.
    const prepared = await this.broadcast.prepareAudienceList(
      `NSE Academy subscription campaign - ${audience}`,
      await this.broadcast.listAudience(audience),
    );

    const scheduledAt = when.toISOString();
    const campaign = await this.brevo.createCampaign({
      name: `Subscription campaign - ${audience} - ${scheduledAt}`,
      subject,
      htmlContent: html,
      listIds: [prepared.listId],
      scheduledAt,
    });
    await this.prisma.broadcastCampaign.create({
      data: { brevoCampaignId: campaign.id, subject, htmlContent: html, tier: audience, audienceCount: prepared.audienceCount, failedCount: prepared.failed.length },
    });
    this.logger.log(`Scheduled Brevo campaign ${campaign.id} (${audience}, ${prepared.audienceCount} recipients) for ${scheduledAt}`);
    return { audience, campaignId: campaign.id, listId: prepared.listId, scheduledAt, audienceCount: prepared.audienceCount, excluded: prepared.excluded, failed: prepared.failed };
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

  /**
   * Everything the admin screen needs in one call: for each audience its subject and how many people would really be
   * mailed, the campaigns waiting in Brevo, and how the recently sent ones performed. Brevo being down leaves the
   * audience figures intact and says so.
   */
  async overview() {
    const audiences = await Promise.all(
      AUDIENCES.map(async (audience) => ({ audience, subject: subscriptionSubject(audience), ...(await this.broadcast.getAudiencePreview(audience)) })),
    );
    let brevo: { queued: unknown[]; sent: unknown[]; error: string | null };
    try {
      const [queued, sent] = await Promise.all([this.brevo.listCampaigns('queued', 20), this.brevo.listCampaigns('sent', 10)]);
      const tag = (c: { name: string }) => ({ ...c, subscriptionCampaign: c.name.startsWith('Subscription campaign') });
      brevo = { queued: queued.map(tag), sent: sent.map(tag), error: null };
    } catch (err) {
      brevo = { queued: [], sent: [], error: (err as Error).message };
    }
    return { audiences, ...brevo };
  }
}

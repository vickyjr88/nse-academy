import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { BroadcastService } from '../broadcast/broadcast.service';
import { loadDailyCloses } from '../market-data/price-history';
import { EXAMPLE_POSITIONS, buildExampleWatch } from './example-watch';
import { Audience, buildSubscriptionEmail } from './subscription-email';

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
}

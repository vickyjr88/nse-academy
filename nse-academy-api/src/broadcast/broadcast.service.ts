import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import { ComposeBroadcastDto } from './dto/compose-broadcast.dto';

const SYNC_PAGE_SIZE = 500;
const SYNC_CONCURRENCY = 10;

type Tier = 'free' | 'intermediary' | 'premium';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
    private readonly config: ConfigService,
  ) {}

  private audienceWhere(tier?: Tier) {
    return tier ? { subscription: { tier } } : {};
  }

  async getAudiencePreview(tier?: Tier): Promise<{ count: number }> {
    const count = await this.prisma.user.count({ where: this.audienceWhere(tier) });
    return { count };
  }

  private async syncAudienceToBrevo(
    tier: Tier | undefined,
    listId: number,
  ): Promise<{ synced: number; failedEmails: string[] }> {
    const where = this.audienceWhere(tier);
    let skip = 0;
    let synced = 0;
    const failedEmails: string[] = [];

    for (;;) {
      const users = await this.prisma.user.findMany({
        where,
        select: { email: true, name: true },
        skip,
        take: SYNC_PAGE_SIZE,
        orderBy: { createdAt: 'asc' },
      });
      if (users.length === 0) break;

      for (let i = 0; i < users.length; i += SYNC_CONCURRENCY) {
        const batch = users.slice(i, i + SYNC_CONCURRENCY);
        const results = await Promise.all(
          batch.map((u) =>
            this.brevo
              .upsertContact({
                email: u.email,
                attributes: { FIRSTNAME: u.name },
                listIds: [listId],
              })
              .then((ok) => ({ email: u.email, ok })),
          ),
        );
        for (const r of results) {
          if (r.ok) synced++;
          else failedEmails.push(r.email);
        }
      }

      skip += SYNC_PAGE_SIZE;
    }

    return { synced, failedEmails };
  }

  async composeAndSend(dto: ComposeBroadcastDto): Promise<{
    campaignId: number;
    audienceCount: number;
    failedCount: number;
    failedEmails: string[];
  }> {
    const listIdRaw = this.config.get<string>('BREVO_BROADCAST_LIST_ID');
    const listId = listIdRaw ? parseInt(listIdRaw, 10) : NaN;
    if (!listId || Number.isNaN(listId)) {
      throw new BadRequestException(
        'BREVO_BROADCAST_LIST_ID is not configured - create a list in Brevo and set its id in the API env',
      );
    }

    const { synced: audienceCount, failedEmails } = await this.syncAudienceToBrevo(dto.tier, listId);
    if (audienceCount === 0) {
      throw new BadRequestException(
        failedEmails.length > 0
          ? `Could not sync any users to Brevo - all ${failedEmails.length} attempts failed. Check BREVO_API_KEY and server logs.`
          : 'No users match this audience - nothing to send',
      );
    }

    if (failedEmails.length > 0) {
      this.logger.warn(
        `${failedEmails.length} user(s) failed to sync to Brevo and will NOT receive this broadcast: ${failedEmails.join(', ')}`,
      );
    }
    this.logger.log(`Synced ${audienceCount} users to Brevo list ${listId} for a broadcast`);

    try {
      const campaign = await this.brevo.createCampaign({
        name: `${dto.subject} - ${new Date().toISOString()}`,
        subject: dto.subject,
        htmlContent: dto.htmlContent,
        listIds: [listId],
      });
      await this.brevo.sendCampaignNow(campaign.id);

      this.logger.log(`Sent broadcast campaign ${campaign.id} to ${audienceCount} users`);
      return { campaignId: campaign.id, audienceCount, failedCount: failedEmails.length, failedEmails };
    } catch (err) {
      // Surface the real reason to the admin UI rather than a generic 500 -
      // the audience is already synced at this point, so this is almost
      // always a Brevo config issue (missing key, invalid list) worth acting on.
      throw new BadRequestException((err as Error).message || 'Failed to send broadcast via Brevo');
    }
  }
}

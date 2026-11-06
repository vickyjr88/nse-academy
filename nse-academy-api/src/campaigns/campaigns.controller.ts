import { BadRequestException, Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AUDIENCES, CampaignsService } from './campaigns.service';
import { Audience } from './subscription-email';

function checkAudience(a?: string): Audience {
  if (!a || !AUDIENCES.includes(a as Audience)) throw new BadRequestException(`audience must be one of: ${AUDIENCES.join(', ')}`);
  return a as Audience;
}

@Controller('admin/campaigns/subscription')
@UseGuards(AdminAuthGuard)
export class CampaignsController {
  constructor(private campaigns: CampaignsService) {}

  /** Audiences with their real reachable counts, scheduled campaigns, and how sent ones performed. */
  @Get('overview')
  overview() {
    return this.campaigns.overview();
  }

  /** The email as HTML, for viewing in a browser. ?audience=free|intermediary|premium */
  @Get('preview')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async preview(@Query('audience') audience?: string) {
    return (await this.campaigns.build(checkAudience(audience), { sample: true })).html;
  }

  /** Body: { to, audience? } - sends review copies (all three audiences unless one is named). */
  @Post('sample')
  sample(@Body() body: { to?: string; audience?: string }) {
    if (!body?.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.to)) throw new BadRequestException('"to" must be a valid email address');
    return this.campaigns.sendSamples(body.to, body.audience ? [checkAudience(body.audience)] : undefined);
  }

  /** Body: { audience, confirm: true, scheduledAt: ISO UTC, force? } - schedules a Brevo campaign that Brevo sends at that time. */
  @Post('schedule')
  schedule(@Body() body: { audience?: string; confirm?: boolean; scheduledAt?: string; force?: boolean }) {
    return this.campaigns.scheduleCampaign(checkAudience(body?.audience), {
      confirm: body?.confirm === true,
      scheduledAt: body?.scheduledAt ?? '',
      force: body?.force === true,
    });
  }

  /** Body: { campaignId, to: ["a@x.com"] } - Brevo renders the real campaign and sends it to those addresses only. */
  @Post('test')
  test(@Body() body: { campaignId?: number; to?: string[] }) {
    if (!Number.isInteger(body?.campaignId)) throw new BadRequestException('campaignId is required');
    if (!Array.isArray(body?.to) || body.to.length === 0 || body.to.length > 5 || body.to.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
      throw new BadRequestException('"to" must be 1-5 valid email addresses');
    }
    return this.campaigns.testCampaign(body.campaignId as number, body.to);
  }

  /** Body: { campaignId } - cancels a scheduled campaign. */
  @Post('cancel')
  cancel(@Body() body: { campaignId?: number }) {
    if (!Number.isInteger(body?.campaignId)) throw new BadRequestException('campaignId is required');
    return this.campaigns.cancelCampaign(body.campaignId as number);
  }

  /** Body: { audience, confirm: true } - REAL send to every user on that tier via a Brevo campaign. */
  @Post('send')
  send(@Body() body: { audience?: string; confirm?: boolean }) {
    return this.campaigns.sendCampaign(checkAudience(body?.audience), body?.confirm === true);
  }
}

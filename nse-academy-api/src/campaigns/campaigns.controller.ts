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

  /** Body: { audience, confirm: true } - REAL send to every user on that tier via a Brevo campaign. */
  @Post('send')
  send(@Body() body: { audience?: string; confirm?: boolean }) {
    return this.campaigns.sendCampaign(checkAudience(body?.audience), body?.confirm === true);
  }
}

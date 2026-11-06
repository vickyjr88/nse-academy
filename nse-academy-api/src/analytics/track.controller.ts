import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { TrackDto } from './track.dto';
import { HourlyLimiter, cleanPath, cleanUtm, detectDevice, isBot, referrerHost, validVisitorId } from './track-rules';

/**
 * Public, unauthenticated page-view beacon. It answers 204 to everything - a rejected or ignored view is not an error
 * the browser should care about - and quietly drops bots, "Do Not Track" visitors, junk paths and floods.
 */
@Controller('public/track')
export class TrackController {
  private readonly limiter = new HourlyLimiter();

  constructor(
    private analytics: AnalyticsService,
    private config: ConfigService,
  ) {}

  private ownHosts(): string[] {
    const hosts = ['nseacademy.vitaldigitalmedia.net'];
    for (const key of ['WEB_URL', 'SITE_URL']) {
      try {
        const v = this.config.get<string>(key);
        if (v) hosts.push(new URL(v).hostname);
      } catch {
        /* ignore a malformed setting */
      }
    }
    return hosts;
  }

  @Post()
  @HttpCode(204)
  async track(@Body() body: TrackDto, @Headers('user-agent') userAgent?: string, @Headers('dnt') dnt?: string): Promise<void> {
    if (dnt === '1' || isBot(userAgent)) return;
    if (!validVisitorId(body.v)) return;
    const path = cleanPath(body.p);
    if (!path) return;
    if (!this.limiter.allow(body.v)) return;
    await this.analytics.record({
      visitorId: body.v,
      path,
      referrerHost: referrerHost(body.r, this.ownHosts()),
      utmSource: cleanUtm(body.us),
      utmMedium: cleanUtm(body.um),
      utmCampaign: cleanUtm(body.uc),
      device: detectDevice(userAgent),
    });
  }
}

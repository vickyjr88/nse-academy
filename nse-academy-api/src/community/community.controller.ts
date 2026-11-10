import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TierGuard } from '../auth/tier.guard';
import { RequireTier } from '../auth/tier.decorator';

/**
 * Where Premium members join the investors' community. A WhatsApp group invite link lets anyone who has it in, so it is
 * given only to signed-in Premium members, never cached, and empty until WHATSAPP_CHANNEL_URL is set.
 */
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('premium')
@Controller('community')
export class CommunityController {
  constructor(private config: ConfigService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get() {
    const url = (this.config.get<string>('WHATSAPP_CHANNEL_URL') ?? '').trim();
    return { whatsappChannelUrl: /^https:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel)\/\S+$/i.test(url) ? url : null };
  }
}

import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Where members can join the investors' community. Empty until WHATSAPP_CHANNEL_URL is set, so nothing links to a channel that does not exist. */
@Controller('public/community')
export class CommunityController {
  constructor(private config: ConfigService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  get() {
    const url = (this.config.get<string>('WHATSAPP_CHANNEL_URL') ?? '').trim();
    return { whatsappChannelUrl: /^https:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel)\/\S+$/i.test(url) ? url : null };
  }
}

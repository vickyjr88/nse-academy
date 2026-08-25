import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { BroadcastService } from './broadcast.service';
import { ComposeBroadcastDto } from './dto/compose-broadcast.dto';

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin/broadcast')
export class BroadcastController {
  constructor(private broadcast: BroadcastService) {}

  @Get('audience')
  @ApiOperation({ summary: 'Preview how many users a broadcast would reach' })
  @ApiQuery({ name: 'tier', required: false, enum: ['free', 'intermediary', 'premium'] })
  getAudience(@Query('tier') tier?: 'free' | 'intermediary' | 'premium') {
    return this.broadcast.getAudiencePreview(tier);
  }

  @Post('send')
  @ApiOperation({ summary: 'Compose and immediately send an announcement email to all (or filtered) users' })
  send(@Body() dto: ComposeBroadcastDto) {
    return this.broadcast.composeAndSend(dto);
  }
}

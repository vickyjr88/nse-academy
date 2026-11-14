import { Body, Controller, Delete, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService } from './push.service';

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Register this phone for push notifications (the member switched them on in the app)' })
  register(@Req() req, @Body() body: { token?: string; platform?: string }) {
    return this.push.register(req.user.id, body?.token ?? '', body?.platform === 'ios' ? 'ios' : 'android');
  }

  @Delete()
  @ApiOperation({ summary: 'Stop push notifications to this phone' })
  unregister(@Req() req, @Query('token') token: string) {
    return this.push.unregister(req.user.id, token ?? '');
  }
}

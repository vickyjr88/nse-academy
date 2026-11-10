import { BadRequestException, Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { MarketDigestService } from './market-digest.service';

class DigestPreferenceDto {
  @IsBoolean()
  enabled!: boolean;
}

class UnsubscribeDto {
  @IsString()
  @MaxLength(64)
  u!: string;

  @IsString()
  @MaxLength(64)
  t!: string;
}

@ApiTags('digest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('digest')
export class DigestController {
  constructor(private digest: MarketDigestService) {}

  @Get()
  get(@Req() req: { user: { id: string } }) {
    return this.digest.getPreference(req.user.id);
  }

  @Put()
  set(@Req() req: { user: { id: string } }, @Body() body: DigestPreferenceDto) {
    return this.digest.setPreference(req.user.id, body.enabled);
  }
}

/** The one-click unsubscribe from an email. A POST so a mail scanner opening the link cannot switch anything off. */
@Controller('public/digest')
export class PublicDigestController {
  constructor(private digest: MarketDigestService) {}

  @Post('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Body() body: UnsubscribeDto) {
    if (!(await this.digest.unsubscribe(body.u, body.t))) throw new BadRequestException('This link is not valid. Turn the digest off in your settings instead.');
    return { enabled: false };
  }
}

@Controller('admin/digest')
@UseGuards(AdminAuthGuard)
export class AdminDigestController {
  constructor(private digest: MarketDigestService) {}

  /** Body: { email }. Sends the latest report's digest to that member now, opted in or not. */
  @Post('test')
  test(@Body() body: { email?: string }) {
    if (!body?.email) throw new BadRequestException('email is required');
    return this.digest.sendTest(body.email);
  }

  /** Runs the whole evening job now (same as the 21:20 cron). */
  @Post('run')
  run() {
    return this.digest.runAll();
  }
}

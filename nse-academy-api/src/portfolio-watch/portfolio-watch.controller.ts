import { BadRequestException, Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TierGuard } from '../auth/tier.guard';
import { RequireTier } from '../auth/tier.decorator';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { PortfolioWatchService } from './portfolio-watch.service';

class WatchSettingsDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('portfolio-watch')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('premium')
@Controller('portfolio-watch')
export class PortfolioWatchController {
  constructor(private watch: PortfolioWatchService) {}

  @Get()
  @ApiOperation({ summary: 'What the portfolio watch would tell you right now, and whether the email is on' })
  preview(@Req() req: { user: { id: string } }) {
    return this.watch.preview(req.user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Turn the daily portfolio-watch email on or off' })
  settings(@Req() req: { user: { id: string } }, @Body() body: WatchSettingsDto) {
    return this.watch.setEnabled(req.user.id, body.enabled);
  }
}

@Controller('admin/portfolio-watch')
@UseGuards(AdminAuthGuard)
export class AdminPortfolioWatchController {
  constructor(private watch: PortfolioWatchService) {}

  /** Body: { email, force?, dryRun? }. dryRun returns what would be sent without writing or emailing. */
  @Post('send')
  send(@Body() body: { email?: string; force?: boolean; dryRun?: boolean }) {
    if (!body?.email) throw new BadRequestException('email is required');
    return this.watch.sendForEmail(body.email, { force: !!body.force, dryRun: !!body.dryRun });
  }

  /** Runs the whole evening job now (same as the 16:30 cron). */
  @Post('run')
  run() {
    return this.watch.runAll();
  }
}

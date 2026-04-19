import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get referral stats and code for the logged-in user' })
  async getStats(@Request() req) {
    return this.referralsService.getStats(req.user.id);
  }
}

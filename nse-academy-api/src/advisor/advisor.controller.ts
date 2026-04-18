import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('advisor')
@ApiBearerAuth()
@Controller('advisor')
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @UseGuards(JwtAuthGuard)
  @Get('recommendations')
  @ApiOperation({ summary: 'Get stock recommendations based on investor profile' })
  async getRecommendations(@Request() req) {
    return this.advisorService.getRecommendations(req.user.id);
  }
}

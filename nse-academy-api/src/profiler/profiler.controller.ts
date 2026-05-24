import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShareProfileDto } from './dto/share-profile.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { ProfilerService } from './profiler.service';

@ApiTags('profiler')
@Controller('profiler')
export class ProfilerController {
  constructor(private profiler: ProfilerService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Get all investor profiler quiz questions' })
  getQuestions() {
    return this.profiler.getQuestions();
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit quiz answers and receive computed InvestorProfile' })
  submit(@Request() req: any, @Body() dto: SubmitQuizDto) {
    return this.profiler.submitQuiz(req.user.id, dto);
  }

  @Post('share')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle public sharing for the caller’s investor profile' })
  share(@Request() req: any, @Body() dto: ShareProfileDto) {
    return this.profiler.setShareVisibility(req.user.id, dto.isPublic);
  }

  @Get('public/:slug')
  @ApiOperation({ summary: 'Fetch a publicly-shared investor profile by slug' })
  getPublic(@Param('slug') slug: string) {
    return this.profiler.getPublicProfile(slug);
  }

  @Get('public-slugs')
  @ApiOperation({ summary: 'List slugs of all publicly-shared profiles (for sitemap)' })
  listPublicSlugs() {
    return this.profiler.listPublicSlugs();
  }
}

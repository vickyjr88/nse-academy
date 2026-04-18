import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
}

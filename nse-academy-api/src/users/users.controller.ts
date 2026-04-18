import { Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@Request() req: any) {
    return this.users.findById(req.user.id);
  }

  @Get('me/progress')
  @ApiOperation({ summary: 'Get lesson progress for current user' })
  getProgress(@Request() req: any) {
    return this.users.getProgress(req.user.id);
  }

  @Post('me/progress/:lessonId/complete')
  @ApiOperation({ summary: 'Mark a lesson as complete' })
  complete(@Request() req: any, @Param('lessonId') lessonId: string) {
    return this.users.markLessonComplete(req.user.id, lessonId);
  }
}

import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinancialAdvisorService } from './financial-advisor.service';
import { CreateAdvisorProfileDto } from './dto/create-advisor-profile.dto';
import { UpdateAdvisorProfileDto } from './dto/update-advisor-profile.dto';
import { SubmitQueryDto } from './dto/submit-query.dto';
import { PostMessageDto } from './dto/post-message.dto';
import { PublishInsightDto } from './dto/publish-insight.dto';
import { SendAlertDto } from './dto/send-alert.dto';

@ApiTags('financial-advisors')
@Controller('financial-advisors')
export class FinancialAdvisorsPublicController {
  constructor(private advisor: FinancialAdvisorService) {}

  @Get()
  list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('specialty') specialty?: string) {
    return this.advisor.listPublicAdvisors({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      specialty,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.advisor.getPublicAdvisorProfile(id);
  }
}

@ApiTags('financial-advisor')
@Controller('financial-advisor')
@UseGuards(JwtAuthGuard)
export class FinancialAdvisorController {
  constructor(private advisor: FinancialAdvisorService) {}

  @Post('register')
  register(@Request() req: any, @Body() dto: CreateAdvisorProfileDto) {
    return this.advisor.becomeAdvisor(req.user.id, dto);
  }

  @Put('profile')
  updateProfile(@Request() req: any, @Body() dto: UpdateAdvisorProfileDto) {
    return this.advisor.updateAdvisorProfile(req.user.id, dto);
  }

  @Get('me')
  me(@Request() req: any) {
    return this.advisor.getMyAdvisorProfile(req.user.id);
  }

  @Post('connect/:advisorId')
  connect(@Request() req: any, @Param('advisorId') advisorId: string) {
    return this.advisor.requestConnection(advisorId, req.user.id);
  }

  @Get('connections')
  connections(@Request() req: any) {
    return this.advisor.listMyConnections(req.user.id);
  }

  @Post('clients/:clientRowId/respond')
  respond(@Request() req: any, @Param('clientRowId') clientRowId: string, @Body() body: { accept: boolean }) {
    return this.advisor.respondToConnection(req.user.id, clientRowId, !!body.accept);
  }

  @Get('clients')
  clients(@Request() req: any, @Query('status') status?: string) {
    return this.advisor.listMyClients(req.user.id, status);
  }

  @Get('clients/:userId')
  clientProfile(@Request() req: any, @Param('userId') userId: string) {
    return this.advisor.getClientProfile(req.user.id, userId);
  }

  @Post('queries')
  submitQuery(@Request() req: any, @Body() body: SubmitQueryDto) {
    return this.advisor.submitQuery(req.user.id, body.advisorId, body);
  }

  @Get('queries')
  queriesInbox(@Request() req: any, @Query('status') status?: string) {
    return this.advisor.listQueriesForAdvisor(req.user.id, status);
  }

  @Get('queries/mine')
  myQueries(@Request() req: any) {
    return this.advisor.listMyQueries(req.user.id);
  }

  @Get('queries/:id')
  queryThread(@Request() req: any, @Param('id') id: string) {
    return this.advisor.getQueryThread(req.user.id, id);
  }

  @Post('queries/:id/answer')
  answerQuery(@Request() req: any, @Param('id') id: string, @Body() dto: PostMessageDto) {
    return this.advisor.answerQuery(req.user.id, id, dto);
  }

  @Post('queries/:id/reply')
  replyToQuery(@Request() req: any, @Param('id') id: string, @Body() dto: PostMessageDto) {
    return this.advisor.replyAsClient(req.user.id, id, dto);
  }

  @Post('insights')
  publishInsight(@Request() req: any, @Body() dto: PublishInsightDto) {
    return this.advisor.publishInsight(req.user.id, dto);
  }

  @Get('insights')
  myInsights(@Request() req: any) {
    return this.advisor.listAdvisorInsights(req.user.id);
  }

  @Get('insights/feed')
  insightsFeed(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.advisor.listInsightsForClient(req.user.id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Post('alerts')
  sendAlert(@Request() req: any, @Body() dto: SendAlertDto) {
    return this.advisor.sendAlert(req.user.id, dto);
  }

  @Get('alerts')
  myAlerts(@Request() req: any) {
    return this.advisor.listMyAlerts(req.user.id);
  }
}

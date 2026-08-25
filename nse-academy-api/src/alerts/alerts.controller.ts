import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TierGuard } from '../auth/tier.guard';
import { RequireTier } from '../auth/tier.decorator';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TierGuard)
@RequireTier('intermediary')
@Controller()
export class AlertsController {
  constructor(private alerts: AlertsService) {}

  @Post('alerts')
  @ApiOperation({ summary: 'Create a price alert' })
  createAlert(@Req() req: { user: { id: string } }, @Body() body: CreateAlertDto) {
    return this.alerts.createAlert(req.user.id, body);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'List the current user price alerts' })
  listAlerts(@Req() req: { user: { id: string } }) {
    return this.alerts.listAlerts(req.user.id);
  }

  @Delete('alerts/:id')
  @ApiOperation({ summary: 'Delete a price alert' })
  deleteAlert(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.alerts.deleteAlert(req.user.id, id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List the current user notifications' })
  listNotifications(@Req() req: { user: { id: string } }) {
    return this.alerts.listNotifications(req.user.id);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  markRead(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.alerts.markRead(req.user.id, id);
  }

  @Post('notifications/read-all')
  @ApiOperation({ summary: 'Mark all notifications read' })
  markAllRead(@Req() req: { user: { id: string } }) {
    return this.alerts.markAllRead(req.user.id);
  }

  @Get('notifications/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  unreadCount(@Req() req: { user: { id: string } }) {
    return this.alerts.unreadCount(req.user.id);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { AdminAuditService } from './admin-audit.service';

const int = (v: string | undefined, fallback: number) => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private audit: AdminAuditService) {}

  @Get()
  list(
    @Query('actor') actor?: string,
    @Query('method') method?: string,
    @Query('q') q?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('failed') failed?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({ actor, method, q, entityType, entityId, failedOnly: failed === 'true', page: int(page, 1), limit: int(limit, 50) });
  }

  @Get('actors')
  actors() {
    return this.audit.actors();
  }
}

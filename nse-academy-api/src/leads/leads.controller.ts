import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { LeadsService } from './leads.service';

interface CaptureBody {
  email: string;
  name?: string | null;
  magnetSlug: string;
  source?: string | null;
  referralCode?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
}

@Controller('leads')
export class LeadsController {
  constructor(private service: LeadsService) {}

  // Public capture — returns the persisted lead so the client can call the
  // download-tracker with its id.
  @Post()
  async capture(@Body() body: CaptureBody) {
    const lead = await this.service.capture(body);
    return {
      id: lead.id,
      email: lead.email,
      magnetSlug: lead.magnetSlug,
      createdAt: lead.createdAt,
    };
  }

  // Public — fired from the success screen when the user clicks the download
  // button. Idempotent counter increment + downloadedAt timestamp.
  @Post(':id/download')
  recordDownload(@Param('id') id: string) {
    return this.service.recordDownload(id);
  }

  // --- Admin ---

  @Get()
  @UseGuards(AdminAuthGuard)
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('magnetSlug') magnetSlug?: string,
    @Query('q') q?: string,
  ) {
    return this.service.list({
      page: Number(page),
      limit: Number(limit),
      magnetSlug,
      q,
    });
  }

  @Get('stats')
  @UseGuards(AdminAuthGuard)
  stats() {
    return this.service.stats();
  }

  @Get('export.csv')
  @UseGuards(AdminAuthGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Res() res: Response,
    @Query('magnetSlug') magnetSlug?: string,
  ) {
    const csv = await this.service.exportCsv(magnetSlug);
    const filename = `leads${magnetSlug ? `-${magnetSlug}` : ''}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }
}

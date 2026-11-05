import { BadRequestException, Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { MarketReportService } from './market-report.service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const checkYmd = (ymd: string) => {
  if (!YMD.test(ymd)) throw new BadRequestException('date must be YYYY-MM-DD');
  return ymd;
};

/** Unauthenticated, read-only, market data and the story only - nothing about users or revenue. */
@Controller('public/market-reports')
export class PublicMarketReportsController {
  constructor(private reports: MarketReportService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  list(@Query('limit') limit = '30') {
    return this.reports.listPublic(Number(limit) || 30);
  }

  // Declared before ':ymd' so "latest" is not captured as a date.
  @Get('latest')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  latest() {
    return this.reports.getLatestPublic();
  }

  @Get(':ymd')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  get(@Param('ymd') ymd: string) {
    return this.reports.getPublic(checkYmd(ymd));
  }
}

@Controller('admin/market-reports')
@UseGuards(AdminAuthGuard)
export class AdminMarketReportsController {
  constructor(private reports: MarketReportService) {}

  /** Body: { date?, force?, notify?, narrative?, narrativeAuthor? } */
  @Post('generate')
  async generate(@Body() body: { date?: string; force?: boolean; notify?: boolean; narrative?: unknown; narrativeAuthor?: string }) {
    const { report, created, note, problems } = await this.reports.generate({
      date: body?.date,
      force: !!body?.force,
      notify: !!body?.notify,
      narrative: body?.narrative,
      narrativeAuthor: body?.narrativeAuthor,
    });
    return { sessionDate: report.sessionDate, status: report.status, created, aiGenerated: report.aiGenerated, aiModel: report.aiModel, note, problems };
  }

  @Get(':ymd')
  get(@Param('ymd') ymd: string) {
    return this.reports.getAdmin(checkYmd(ymd));
  }

  @Post(':ymd/unpublish')
  unpublish(@Param('ymd') ymd: string) {
    return this.reports.setStatus(checkYmd(ymd), 'unpublished').then((r) => ({ sessionDate: r.sessionDate, status: r.status }));
  }

  @Post(':ymd/publish')
  publish(@Param('ymd') ymd: string) {
    return this.reports.setStatus(checkYmd(ymd), 'published').then((r) => ({ sessionDate: r.sessionDate, status: r.status }));
  }
}

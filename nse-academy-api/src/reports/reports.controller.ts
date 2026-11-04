import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { DailyReportService } from './daily-report.service';

@Controller('admin/reports')
@UseGuards(AdminAuthGuard)
export class ReportsController {
  constructor(private reports: DailyReportService) {}

  /** The report's data as JSON. ?date=YYYY-MM-DD, defaults to yesterday (Nairobi time). */
  @Get('daily')
  preview(@Query('date') date?: string) {
    return this.reports.build(this.checkDate(date));
  }

  /** Send the report now. Body: { date?: 'YYYY-MM-DD', to?: 'a@x.com,b@y.com' } - `to` marks it as a test. */
  @Post('daily/send')
  send(@Body() body: { date?: string; to?: string }) {
    const to = (body?.to ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    if (to.some((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) {
      throw new BadRequestException('"to" must be one or more valid email addresses');
    }
    return this.reports.sendDailyReport({ date: this.checkDate(body?.date), to: to.length ? to : undefined });
  }

  private checkDate(date?: string): string | undefined {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date must be YYYY-MM-DD');
    return date || undefined;
  }
}

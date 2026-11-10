import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { EmailSuppressionService } from './email-suppression.service';

@Controller('admin/email-suppressions')
@UseGuards(AdminAuthGuard)
export class EmailSuppressionController {
  constructor(private suppression: EmailSuppressionService) {}

  @Get()
  list(@Query('limit') limit?: string) {
    return this.suppression.list(parseInt(limit ?? '200', 10) || 200);
  }

  /** Stops all email to an address. Body: { email }. */
  @Post()
  async add(@Body() body: { email?: string }) {
    if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) throw new BadRequestException('A valid email is required');
    await this.suppression.suppress(body.email, 'manual');
    return { suppressed: body.email.trim().toLowerCase() };
  }

  /** Lets us email an address again (it may still be blocklisted at Brevo, which only Brevo can undo). */
  @Delete(':email')
  async release(@Param('email') email: string) {
    return { released: await this.suppression.release(email) };
  }
}

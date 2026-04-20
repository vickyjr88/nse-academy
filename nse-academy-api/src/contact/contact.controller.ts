import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { AdminAuthGuard } from '../admin/admin-auth.guard';

@Controller('contact')
export class ContactController {
  constructor(private service: ContactService) {}

  @Post()
  submit(@Body() body: { name: string; email: string; subject: string; message: string }) {
    return this.service.create(body);
  }

  @Get()
  @UseGuards(AdminAuthGuard)
  list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.findAll(Number(page), Number(limit));
  }

  @Get('new-count')
  @UseGuards(AdminAuthGuard)
  newCount() {
    return this.service.countNew();
  }

  @Patch(':id/read')
  @UseGuards(AdminAuthGuard)
  markRead(@Param('id') id: string) {
    return this.service.markRead(id);
  }

  @Patch(':id/replied')
  @UseGuards(AdminAuthGuard)
  markReplied(@Param('id') id: string) {
    return this.service.markReplied(id);
  }
}

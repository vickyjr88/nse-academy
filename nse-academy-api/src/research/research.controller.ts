import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ResearchService } from './research.service';

class GenerateDto {
  @IsIn(['FOCUS_LIST', 'BRIEF']) kind!: 'FOCUS_LIST' | 'BRIEF';
  @IsOptional() @IsString() @MaxLength(7) period?: string;
  @IsOptional() @IsString() @MaxLength(12) ticker?: string;
}

class UpdateNoteDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(400) summary?: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;
  @IsOptional() @IsString() @MaxLength(200) reviewedBy?: string;
}

/** Unauthenticated and read-only: published research only. */
@Controller('public/research')
export class PublicResearchController {
  constructor(private research: ResearchService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  list(@Query('kind') kind?: string) {
    return this.research.listPublished(kind);
  }

  // Declared before ':slug' so "brief" is not read as a note address.
  @Get('brief/:ticker')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  brief(@Param('ticker') ticker: string) {
    return this.research.briefFor(ticker);
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  get(@Param('slug') slug: string) {
    return this.research.getPublished(slug);
  }
}

@Controller('admin/research')
@UseGuards(AdminAuthGuard)
export class AdminResearchController {
  constructor(private research: ResearchService) {}

  @Get()
  list() {
    return this.research.adminList();
  }

  /** Drafts a monthly focus list (period YYYY-MM, default this month) or a company brief (ticker) from the stored prices. */
  @Post('generate')
  generate(@Body() body: GenerateDto) {
    return body.kind === 'FOCUS_LIST' ? this.research.generateFocusList(body.period) : this.research.generateBrief(body.ticker ?? '');
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateNoteDto) {
    return this.research.update(id, body);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.research.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.research.unpublish(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.research.remove(id);
  }
}

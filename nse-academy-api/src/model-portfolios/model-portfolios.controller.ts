import { Body, Controller, Delete, Get, Header, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TierGuard } from '../auth/tier.guard';
import { RequireTier } from '../auth/tier.decorator';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { ModelPortfoliosService } from './model-portfolios.service';

class HoldingDto {
  @IsString() @MaxLength(12) ticker!: string;
  @IsNumber() weightPct!: number;
  @IsOptional() @IsString() @MaxLength(400) rationale?: string;
}

class ModelDto {
  @IsString() @MaxLength(80) slug!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(400) summary!: string;
  @IsString() @MaxLength(8000) description!: string;
  @IsOptional() @IsString() riskProfile?: string;
  @IsString() @MaxLength(10) inceptionDate!: string;
  @IsOptional() @IsString() @MaxLength(200) reviewedBy?: string;
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => HoldingDto) holdings!: HoldingDto[];
}

/** Unauthenticated and read-only: published models and how they have done. */
@Controller('public/model-portfolios')
export class PublicModelPortfoliosController {
  constructor(private models: ModelPortfoliosService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  async list() {
    return { note: ModelPortfoliosService.NOTE, data: await this.models.listPublished() };
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=600')
  async get(@Param('slug') slug: string) {
    return { note: ModelPortfoliosService.NOTE, model: await this.models.getPublished(slug) };
  }
}

@ApiTags('model-portfolios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TierGuard)
@Controller('model-portfolios')
export class MemberModelPortfoliosController {
  constructor(private models: ModelPortfoliosService) {}

  /** How the member's holdings line up with a model. */
  @Get(':slug/compare')
  @RequireTier('intermediary')
  compare(@Req() req: { user: { id: string } }, @Param('slug') slug: string) {
    return this.models.compare(req.user.id, slug);
  }

  /** Copies the model's weights into the member's own targets (replacing any they had). */
  @Post(':slug/use-as-targets')
  @RequireTier('premium')
  use(@Req() req: { user: { id: string } }, @Param('slug') slug: string) {
    return this.models.useAsTargets(req.user.id, slug);
  }
}

@Controller('admin/model-portfolios')
@UseGuards(AdminAuthGuard)
export class AdminModelPortfoliosController {
  constructor(private models: ModelPortfoliosService) {}

  @Get()
  list() {
    return this.models.adminList();
  }

  @Post()
  create(@Body() body: ModelDto) {
    return this.models.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: ModelDto) {
    return this.models.update(id, body);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.models.publish(id);
  }

  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.models.unpublish(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.models.remove(id);
  }
}

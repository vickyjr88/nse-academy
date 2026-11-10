import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TierGuard } from '../auth/tier.guard';
import { RequireTier } from '../auth/tier.decorator';
import { AllocationService } from './allocation.service';

class TargetDto {
  @IsString()
  @Matches(/^[A-Za-z0-9.]{1,12}$/, { message: 'ticker must be 1-12 letters or digits' })
  ticker!: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  weightPct!: number;
}

class SetTargetsDto {
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => TargetDto)
  targets!: TargetDto[];
}

@ApiTags('allocation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TierGuard)
@Controller('allocation')
export class AllocationController {
  constructor(private allocation: AllocationService) {}

  /** Weights by stock and by sector, concentration notes, and the member's targets. Intermediary and up. */
  @Get()
  @RequireTier('intermediary')
  overview(@Req() req: { user: { id: string } }) {
    return this.allocation.overview(req.user.id);
  }

  @Get('targets')
  @RequireTier('premium')
  targets(@Req() req: { user: { id: string } }) {
    return this.allocation.getTargets(req.user.id);
  }

  @Put('targets')
  @RequireTier('premium')
  setTargets(@Req() req: { user: { id: string } }, @Body() body: SetTargetsDto) {
    return this.allocation.setTargets(req.user.id, body.targets);
  }

  /** What it would take to reach the targets, with broker costs. `cash` is new money to invest, in KSh. */
  @Get('rebalance')
  @RequireTier('premium')
  rebalance(@Req() req: { user: { id: string } }, @Query('cash') cash?: string) {
    const c = Number(cash);
    return this.allocation.plan(req.user.id, Number.isFinite(c) && c > 0 ? Math.min(c, 1_000_000_000) : 0);
  }
}

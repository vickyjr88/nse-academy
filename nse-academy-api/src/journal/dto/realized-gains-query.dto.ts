import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class RealizedGainsQueryDto {
  @ApiPropertyOptional({ example: 2026, description: 'Calendar year to filter by. Omit for all-time.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, Max } from 'class-validator';

export class UpdateHoldingCostDto {
  @ApiProperty({ example: 28.4, description: 'Average cost per share in KES' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Max(1_000_000)
  avgCost!: number;
}

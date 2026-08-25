import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateDividendDto {
  @ApiPropertyOptional({ example: 'clx1234567890' })
  @IsOptional()
  @IsString()
  brokerId?: string;

  @ApiPropertyOptional({ example: 'SCOM' })
  @IsOptional()
  @IsString()
  ticker?: string;

  @ApiPropertyOptional({ example: 'Safaricom PLC' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 4500 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amountKes?: number;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsISO8601()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Interim dividend' })
  @IsOptional()
  @IsString()
  notes?: string;
}

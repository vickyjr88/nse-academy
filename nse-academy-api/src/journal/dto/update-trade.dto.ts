import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class UpdateTradeDto {
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

  @ApiPropertyOptional({ example: 'BUY', enum: ['BUY', 'SELL'] })
  @IsOptional()
  @IsIn(['BUY', 'SELL'])
  side?: 'BUY' | 'SELL';

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ example: 15.5 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerShare?: number;

  @ApiPropertyOptional({ example: 29.45 })
  @IsOptional()
  @IsNumber()
  feesKes?: number;

  @ApiPropertyOptional({ example: '2026-07-14' })
  @IsOptional()
  @IsISO8601()
  tradeDate?: string;

  @ApiPropertyOptional({ example: 'Bought the dip after Q2 results' })
  @IsOptional()
  @IsString()
  notes?: string;
}

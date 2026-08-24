import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTradeDto {
  @ApiProperty({ example: 'clx1234567890' })
  @IsString()
  brokerId: string;

  @ApiProperty({ example: 'SCOM' })
  @IsString()
  ticker: string;

  @ApiPropertyOptional({ example: 'Safaricom PLC' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ example: 'BUY', enum: ['BUY', 'SELL'] })
  @IsIn(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @ApiProperty({ example: 100 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 15.5 })
  @IsNumber()
  @IsPositive()
  pricePerShare: number;

  @ApiPropertyOptional({
    example: 29.45,
    description: 'Fees actually charged. If omitted, computed from the broker feePercent.',
  })
  @IsOptional()
  @IsNumber()
  feesKes?: number;

  @ApiProperty({ example: '2026-07-14' })
  @IsISO8601()
  tradeDate: string;

  @ApiPropertyOptional({ example: 'Bought the dip after Q2 results' })
  @IsOptional()
  @IsString()
  notes?: string;
}

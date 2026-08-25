import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateDividendDto {
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

  @ApiProperty({
    example: 4500,
    description: 'Net amount received, after the 5% withholding tax already deducted at source.',
  })
  @IsNumber()
  @IsPositive()
  amountKes: number;

  @ApiProperty({ example: '2026-06-30' })
  @IsISO8601()
  paymentDate: string;

  @ApiPropertyOptional({ example: 'Interim dividend' })
  @IsOptional()
  @IsString()
  notes?: string;
}

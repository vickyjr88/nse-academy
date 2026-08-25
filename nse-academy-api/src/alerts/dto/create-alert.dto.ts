import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateAlertDto {
  @ApiProperty({ example: 'SCOM' })
  @IsString()
  ticker: string;

  @ApiProperty({ example: 18.5 })
  @IsNumber()
  @IsPositive()
  targetPrice: number;

  @ApiProperty({ example: 'ABOVE', enum: ['ABOVE', 'BELOW'] })
  @IsIn(['ABOVE', 'BELOW'])
  direction: 'ABOVE' | 'BELOW';
}

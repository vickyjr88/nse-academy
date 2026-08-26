import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class PublishInsightDto {
  @ApiProperty({ example: 'Why I am watching Safaricom this quarter' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Full write-up on the latest earnings and what it means for the stock...' })
  @IsString()
  @MinLength(10)
  body: string;

  @ApiPropertyOptional({ example: ['SCOM'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tickers?: string[];
}

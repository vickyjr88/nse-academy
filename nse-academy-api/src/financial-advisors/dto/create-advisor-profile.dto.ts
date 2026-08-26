import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateAdvisorProfileDto {
  @ApiProperty({ example: 'Certified Financial Planner, 10+ years' })
  @IsString()
  headline: string;

  @ApiProperty({ example: 'I help Kenyan investors build long-term, diversified NSE portfolios.' })
  @IsString()
  bio: string;

  @ApiPropertyOptional({ example: ['Retirement Planning', 'Dividend Investing'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ example: 'CFA, CISI' })
  @IsOptional()
  @IsString()
  credentials?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/photo.jpg' })
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

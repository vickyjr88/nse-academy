import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CaptureLeadDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Jane Wanjiku' })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiProperty({ example: 'free-chapter' })
  @IsString()
  magnetSlug: string;

  @ApiPropertyOptional({ example: 'blog-cta' })
  @IsOptional()
  @IsString()
  source?: string | null;

  @ApiPropertyOptional({ example: 'REF-ABC1' })
  @IsOptional()
  @IsString()
  referralCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmSource?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmMedium?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmCampaign?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmTerm?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmContent?: string | null;
}

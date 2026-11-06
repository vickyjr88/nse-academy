import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class ComposeBroadcastDto {
  @ApiProperty({ example: 'New: Trade Journal, Price Alerts & Dividend Tracking' })
  @IsString()
  @MinLength(1)
  subject: string;

  @ApiProperty({ example: '<p>We just shipped a trade journal...</p>' })
  @IsString()
  @MinLength(10)
  htmlContent: string;

  @ApiPropertyOptional({
    example: 'free',
    enum: ['free', 'intermediary', 'premium'],
    description: 'Restrict the send to a single subscription tier. Omit to reach all users.',
  })
  @IsOptional()
  @IsIn(['free', 'intermediary', 'premium'])
  tier?: 'free' | 'intermediary' | 'premium';

  @ApiPropertyOptional({
    example: 'clx1a2b3c4d5e6f7g8h9',
    description: 'Restrict the send to users with this tag (see /admin/tags). Combines with tier as an AND filter, not a replacement for it.',
  })
  @IsOptional()
  @IsString()
  tagId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Send even though a broadcast with this subject already went to this audience in the last 24 hours.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

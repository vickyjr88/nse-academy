import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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
}

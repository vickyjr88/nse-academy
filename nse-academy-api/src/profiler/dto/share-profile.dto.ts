import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ShareProfileDto {
  @ApiProperty({ example: true, description: 'Whether to make the investor profile public' })
  @IsBoolean()
  isPublic: boolean;
}

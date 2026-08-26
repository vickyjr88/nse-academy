import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LicenseVerifyDto {
  @ApiProperty({ example: 'ref_abc123' })
  @IsString()
  @MinLength(1)
  reference: string;
}

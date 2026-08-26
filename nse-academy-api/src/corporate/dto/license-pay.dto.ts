import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LicensePayDto {
  @ApiProperty({ example: 'starter', description: 'starter | team | sacco' })
  @IsString()
  plan: string;
}

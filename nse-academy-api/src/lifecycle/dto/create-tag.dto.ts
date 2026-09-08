import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class CreateTagDto {
  @ApiProperty({ example: 'engaged-free', description: 'Lowercase, hyphenated identifier - shown as-is in the admin UI and pushed to Brevo as a contact attribute.' })
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'name must be lowercase letters, numbers, and hyphens only (e.g. "engaged-free")',
  })
  name: string;
}

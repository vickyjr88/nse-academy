import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail } from 'class-validator';

export class ApplyTagByEmailDto {
  @ApiProperty({ example: ['jane@example.com'], description: 'Member email addresses to tag (up to 200).' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsEmail({}, { each: true })
  emails: string[];
}

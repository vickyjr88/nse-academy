import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ApplyTagDto {
  @ApiProperty({ example: ['clx1a2b3c4d5e6f7g8h9'], description: 'User IDs to tag.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];
}

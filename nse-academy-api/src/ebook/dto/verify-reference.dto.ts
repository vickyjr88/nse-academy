import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyReferenceDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  reference: string;
}

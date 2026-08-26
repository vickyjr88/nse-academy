import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SubmitQueryDto {
  @ApiProperty({ example: 'clx1234567890' })
  @IsString()
  advisorId: string;

  @ApiProperty({ example: 'Should I keep buying SCOM at current levels?' })
  @IsString()
  @MinLength(5)
  question: string;
}

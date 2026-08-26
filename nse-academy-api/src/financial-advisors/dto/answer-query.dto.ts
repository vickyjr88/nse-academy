import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AnswerQueryDto {
  @ApiProperty({ example: 'At current valuations I would average in gradually rather than lump sum.' })
  @IsString()
  @MinLength(2)
  reply: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitContactDto {
  @ApiProperty({ example: 'Jane Wanjiku' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Billing & Subscription' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'I was charged twice for my subscription this month.' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;
}

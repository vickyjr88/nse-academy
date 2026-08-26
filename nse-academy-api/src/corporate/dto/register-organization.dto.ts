import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @ApiProperty({ example: 'Acme SACCO' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'sacco' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'admin@acmesacco.co.ke' })
  @IsEmail()
  email: string;
}

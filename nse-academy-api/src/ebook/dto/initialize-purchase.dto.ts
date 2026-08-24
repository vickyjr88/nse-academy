import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InitializePurchaseDto {
  @ApiProperty({ example: '4c379aa9-2035-47d8-b8fd-bacc860eea7c' })
  @IsString()
  productId: string;

  @ApiProperty({ example: 999 })
  @IsNumber()
  @Min(1)
  priceKes: number;

  @ApiPropertyOptional({
    example: 'jane@example.com',
    description:
      'Required for guest checkout. Ignored when authenticated (account email is used).',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Jane Wanjiku' })
  @IsOptional()
  @IsString()
  name?: string;
}

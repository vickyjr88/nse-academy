import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class SendAlertDto {
  @ApiProperty({ example: 'SCOM' })
  @IsString()
  ticker: string;

  @ApiProperty({ example: 'BUY', enum: ['BUY', 'SELL'] })
  @IsIn(['BUY', 'SELL'])
  action: 'BUY' | 'SELL';

  @ApiProperty({ example: 'Strong Q3 earnings, raising target price to KSh 22.' })
  @IsString()
  @MinLength(5)
  message: string;

  @ApiPropertyOptional({
    example: 'ckx1y2z3',
    description:
      'Send to a single accepted client by their user id. Omit to send to all of this advisor\'s accepted clients.',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}

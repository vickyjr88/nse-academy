import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MinLength } from 'class-validator';

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
}

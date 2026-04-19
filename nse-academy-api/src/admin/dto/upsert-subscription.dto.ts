import { IsString, IsIn, IsOptional, IsDateString } from 'class-validator';

export class UpsertSubscriptionDto {
  @IsString()
  @IsIn(['free', 'intermediary', 'premium'])
  tier: string;

  @IsString()
  @IsIn(['active', 'cancelled', 'past_due'])
  status: string;

  @IsOptional()
  @IsDateString()
  currentPeriodEnd?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

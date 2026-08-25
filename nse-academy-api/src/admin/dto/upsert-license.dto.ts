import { IsIn, IsInt, IsDateString, IsOptional, IsString, Min } from 'class-validator';

export class UpsertLicenseDto {
  @IsInt()
  @Min(1)
  seats: number;

  @IsInt()
  @Min(0)
  amountKes: number;

  @IsDateString()
  currentPeriodEnd: string;

  @IsIn(['offline', 'paystack'])
  paymentMethod: 'offline' | 'paystack';

  @IsOptional()
  @IsString()
  offlineReference?: string;

  @IsOptional()
  @IsIn(['active', 'cancelled', 'past_due'])
  status?: string;
}

import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateHoldingDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  quantity?: number;

  /** null clears the cost. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Max(1_000_000)
  avgCost?: number | null;

  @IsOptional()
  @IsString()
  companyName?: string;
}

export class CreateHoldingDto {
  @IsString()
  brokerId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9.]{1,12}$/, { message: 'ticker must be 1-12 letters or digits' })
  ticker!: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Max(1_000_000)
  avgCost?: number;

  @IsOptional()
  @IsString()
  companyName?: string;
}

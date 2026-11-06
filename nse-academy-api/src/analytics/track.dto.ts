import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Short field names keep the beacon small. */
export class TrackDto {
  /** Anonymous browser id. */
  @IsString()
  @MaxLength(64)
  v!: string;

  /** Page path. */
  @IsString()
  @MaxLength(300)
  p!: string;

  /** document.referrer, sent on the first page of a visit only. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  r?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  us?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  um?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  uc?: string;
}

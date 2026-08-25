import { IsEmail, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertLicenseDto } from './upsert-license.dto';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsIn(['company', 'school'])
  type: string;

  @IsEmail()
  orgEmail: string;

  @IsString()
  adminName: string;

  @IsEmail()
  adminEmail: string;

  @ValidateNested()
  @Type(() => UpsertLicenseDto)
  license: UpsertLicenseDto;
}

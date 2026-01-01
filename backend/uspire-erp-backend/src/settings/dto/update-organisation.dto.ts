import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrganisationDto {
  @IsString()
  @MinLength(1)
  organisationName!: string;

  @IsOptional()
  @IsString()
  organisationShortName?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string | null;
}

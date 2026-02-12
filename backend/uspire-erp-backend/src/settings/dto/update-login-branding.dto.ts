import { IsOptional, IsString } from 'class-validator';

export class UpdateLoginBrandingDto {
  @IsOptional()
  @IsString()
  loginPageTitle?: string;
}

import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestUnlockDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

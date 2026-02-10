import { IsOptional, IsString, MinLength } from 'class-validator';

export class ForceChangePasswordDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsString()
  emailOrUsername!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  confirmPassword!: string;
}

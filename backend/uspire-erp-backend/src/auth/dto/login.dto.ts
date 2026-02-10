import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  emailOrUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  email?: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

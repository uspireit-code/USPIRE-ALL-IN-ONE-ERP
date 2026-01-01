import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

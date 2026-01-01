import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];
}

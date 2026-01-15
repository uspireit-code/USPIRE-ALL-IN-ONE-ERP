import { IsOptional, IsString } from 'class-validator';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export enum WithholdingProfile {
  NONE = 'NONE',
  STANDARD = 'STANDARD',
  SPECIAL = 'SPECIAL',
}

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Supplier name is required.' })
  name!: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsBoolean()
  vatRegistered?: boolean;

  @IsOptional()
  @IsString()
  defaultPaymentTerms?: string;

  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsEnum(WithholdingProfile)
  withholdingProfile?: WithholdingProfile;

  @IsOptional()
  @IsString()
  @IsEmail({}, { message: 'Email address is not valid.' })
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

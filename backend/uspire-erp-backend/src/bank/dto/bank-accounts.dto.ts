import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export enum BankAccountTypeDto {
  BANK = 'BANK',
  CASH = 'CASH',
}

export class CreateBankAccountFoundationDto {
  @IsString()
  name!: string;

  @IsEnum(BankAccountTypeDto)
  type!: BankAccountTypeDto;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsUUID()
  glAccountId!: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  openingBalance?: string;
}

export class UpdateBankAccountFoundationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(BankAccountTypeDto)
  type?: BankAccountTypeDto;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  openingBalance?: string;
}

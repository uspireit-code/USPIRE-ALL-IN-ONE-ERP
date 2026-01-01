import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum AccountTypeDto {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(AccountTypeDto)
  type!: AccountTypeDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

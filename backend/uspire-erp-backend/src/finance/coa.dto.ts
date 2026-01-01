import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum CoaAccountTypeDto {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum NormalBalanceDto {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum BudgetControlModeDto {
  WARN = 'WARN',
  BLOCK = 'BLOCK',
}

export class CreateCoaAccountDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(CoaAccountTypeDto)
  accountType!: CoaAccountTypeDto;

  @IsOptional()
  @IsString()
  parentAccountId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPosting?: boolean;

  @IsOptional()
  @IsBoolean()
  isPostingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;

  @IsOptional()
  @IsEnum(NormalBalanceDto)
  normalBalance?: NormalBalanceDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  fsMappingLevel1?: string;

  @IsOptional()
  @IsString()
  fsMappingLevel2?: string;

  @IsOptional()
  @IsBoolean()
  isBudgetRelevant?: boolean;

  @IsOptional()
  @IsEnum(BudgetControlModeDto)
  budgetControlMode?: BudgetControlModeDto;
}

export class UpdateCoaAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(CoaAccountTypeDto)
  accountType?: CoaAccountTypeDto;

  @IsOptional()
  @IsString()
  parentAccountId?: string | null;

  @IsOptional()
  @IsBoolean()
  isPosting?: boolean;

  @IsOptional()
  @IsBoolean()
  isPostingAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;

  @IsOptional()
  @IsEnum(NormalBalanceDto)
  normalBalance?: NormalBalanceDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  subCategory?: string;

  @IsOptional()
  @IsString()
  fsMappingLevel1?: string;

  @IsOptional()
  @IsString()
  fsMappingLevel2?: string;

  @IsOptional()
  @IsString()
  ifrsMappingCode?: string;

  @IsOptional()
  @IsBoolean()
  isBudgetRelevant?: boolean;

  @IsOptional()
  @IsEnum(BudgetControlModeDto)
  budgetControlMode?: BudgetControlModeDto;
}

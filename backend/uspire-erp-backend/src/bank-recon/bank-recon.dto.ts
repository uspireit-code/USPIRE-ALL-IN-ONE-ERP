import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsBooleanString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum BankStatementLineClassificationDto {
  SYSTEM_MATCH = 'SYSTEM_MATCH',
  BANK_CHARGE = 'BANK_CHARGE',
  INTEREST = 'INTEREST',
  ERROR = 'ERROR',
  UNIDENTIFIED = 'UNIDENTIFIED',
}

export class CreateBankStatementDto {
  @IsUUID()
  bankAccountId!: string;

  @IsDateString()
  statementStartDate!: string;

  @IsDateString()
  statementEndDate!: string;

  @IsNumber()
  openingBalance!: number;

  @IsNumber()
  closingBalance!: number;
}

export class AddBankStatementLineDto {
  @IsDateString()
  txnDate!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsNumber()
  debitAmount?: number;

  @IsOptional()
  @IsNumber()
  creditAmount?: number;

  @IsOptional()
  @IsEnum(BankStatementLineClassificationDto)
  classification?: BankStatementLineClassificationDto;
}

export class AddBankStatementLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddBankStatementLineDto)
  lines!: AddBankStatementLineDto[];
}

export class ListStatementsQueryDto {
  @IsUUID()
  bankAccountId!: string;
}

export class UnclearedTransactionsQueryDto {
  @IsDateString()
  asAtDate!: string;
}

export class MatchStatementLineDto {
  @IsString()
  @MinLength(1)
  journalLineId!: string;
}

export class ListStatementLinesQueryDto {
  @IsOptional()
  @IsBooleanString()
  matched?: string;
}

export class CreateAdjustmentJournalDto {
  @IsUUID()
  glAccountId!: string;

  @IsDateString()
  postingDate!: string;

  @IsOptional()
  @IsString()
  memo?: string;
}

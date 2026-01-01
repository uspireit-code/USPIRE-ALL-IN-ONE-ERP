import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class LedgerQueryDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsUUID()
  accountingPeriodId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['TB', 'PL', 'BS', 'LEDGER'])
  sourceReport?: 'TB' | 'PL' | 'BS' | 'LEDGER';
}

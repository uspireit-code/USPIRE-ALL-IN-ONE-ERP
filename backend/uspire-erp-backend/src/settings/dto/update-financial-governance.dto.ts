import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

function isNotNull(_: any, value: any) {
  return value !== null;
}

export class UpdateFinancialGovernanceDto {
  @IsOptional()
  @ValidateIf(isNotNull)
  @IsBoolean()
  allowSelfPosting?: boolean | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsBoolean()
  requiresDepartmentOnInvoices?: boolean | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsBoolean()
  requiresProjectOnInvoices?: boolean | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsBoolean()
  requiresFundOnInvoices?: boolean | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  arControlAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  apControlAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  defaultBankClearingAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  arRefundClearingAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  cashClearingAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  arCashClearingAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  unappliedReceiptsAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsInt()
  @Min(0)
  retroPostToleranceDays?: number | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsIn([
    'TENANT_GLOBAL',
    'LEGAL_ENTITY',
    'FISCAL_YEAR',
    'LEGAL_ENTITY_FISCAL_YEAR',
  ])
  journalNumberingScope?:
    | 'TENANT_GLOBAL'
    | 'LEGAL_ENTITY'
    | 'FISCAL_YEAR'
    | 'LEGAL_ENTITY_FISCAL_YEAR'
    | null;
}

import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

function isNotNull(_: any, value: any) {
  return value !== null;
}

export class UpdateSystemConfigDto {
  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  organisationName?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  organisationShortName?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  legalName?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  defaultCurrency?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  country?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  timezone?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsInt()
  financialYearStartMonth?: number | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  dateFormat?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  numberFormat?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  defaultLandingPage?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  defaultDashboard?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  defaultLanguage?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsBoolean()
  demoModeEnabled?: boolean | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  defaultUserRoleCode?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  primaryColor?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  secondaryColor?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  accentColor?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  secondaryAccentColor?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsBoolean()
  allowSelfPosting?: boolean | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  receiptBankName?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  receiptBankAccountName?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  receiptBankAccountNumber?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  receiptBankBranch?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  receiptBankSwiftCode?: string | null;

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
  defaultBankClearingAccountId?: string | null;

  @IsOptional()
  @ValidateIf(isNotNull)
  @IsString()
  unappliedReceiptsAccountId?: string | null;
}

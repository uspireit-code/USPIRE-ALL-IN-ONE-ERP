import { IsIn, IsOptional, IsString } from 'class-validator';

const ENTITY_TYPES = [
  'JOURNAL_ENTRY',
  'JOURNAL_UPLOAD_BATCH',
  'ACCOUNTING_PERIOD',
  'ACCOUNTING_PERIOD_CHECKLIST_ITEM',
  'SUPPLIER_INVOICE',
  'CUSTOMER_INVOICE',
  'FIXED_ASSET',
  'FIXED_ASSET_DEPRECIATION_RUN',
  'BANK_RECONCILIATION_MATCH',
  'IMPREST_CASE',
  'USER',
] as const;

export class AuditEvidenceUploadDto {
  @IsIn(ENTITY_TYPES as unknown as string[])
  entityType!: (typeof ENTITY_TYPES)[number];

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  governanceDomain?: string;

  @IsOptional()
  @IsString()
  governanceActionType?: string;

  @IsOptional()
  @IsString()
  evidenceCategory?: string;

  @IsOptional()
  @IsString()
  retentionClassification?: string;

  @IsOptional()
  @IsString()
  auditSensitivity?: string;

  @IsOptional()
  @IsString()
  justificationText?: string;
}

import { IsIn, IsOptional, IsString } from 'class-validator';

const ENTITY_TYPES = [
  'JOURNAL_ENTRY',
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

export class AuditEvidenceQueryDto {
  @IsOptional()
  @IsIn(ENTITY_TYPES as unknown as string[])
  entityType?: (typeof ENTITY_TYPES)[number];

  @IsOptional()
  @IsString()
  entityId?: string;
}

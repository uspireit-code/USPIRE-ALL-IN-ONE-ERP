import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

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

const EVENT_TYPES = [
  'JOURNAL_POST',
  'PERIOD_CHECKLIST_COMPLETE',
  'PERIOD_CLOSE',
  'SOD_VIOLATION',
  'AP_POST',
  'AR_POST',
  'FA_CAPITALIZE',
  'FA_DEPRECIATION_RUN',
  'FA_DISPOSE',
  'BANK_RECONCILIATION_MATCH',
  'IMPREST_TYPE_POLICY_CREATED',
  'IMPREST_TYPE_POLICY_UPDATED',
  'IMPREST_TYPE_POLICY_STATUS_CHANGE',
  'IMPREST_FACILITY_CREATED',
  'IMPREST_FACILITY_UPDATED',
  'IMPREST_FACILITY_STATUS_CHANGE',
  'IMPREST_CASE_CREATED',
  'IMPREST_CASE_SUBMITTED',
  'IMPREST_CASE_REVIEWED',
  'IMPREST_CASE_APPROVED',
  'IMPREST_CASE_REJECTED',
  'IMPREST_CASE_EVIDENCE_LINKED',
  'IMPREST_CASE_ISSUED',
] as const;

export class AuditEventsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(ENTITY_TYPES as unknown as string[])
  entityType?: (typeof ENTITY_TYPES)[number];

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(EVENT_TYPES as unknown as string[])
  eventType?: (typeof EVENT_TYPES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

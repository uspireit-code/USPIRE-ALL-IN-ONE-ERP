import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateImprestCaseDto {
  @IsUUID()
  facilityId!: string;

  @IsString()
  purpose!: string;

  @IsString()
  justification!: string;

  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsDateString()
  expectedSettlementDate!: string;

  @IsString()
  requestedAmount!: string;

  @IsString()
  currency!: string;
}

export class SubmitImprestCaseDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateImprestSettlementLineDto {
  @IsIn(['EXPENSE', 'CASH_RETURN'] as const)
  type!: 'EXPENSE' | 'CASH_RETURN';

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsString()
  description!: string;

  @IsString()
  amount!: string;

  @IsDateString()
  spentDate!: string;
}

export class UpdateImprestSettlementLineDto {
  @IsOptional()
  @IsIn(['EXPENSE', 'CASH_RETURN'] as const)
  type?: 'EXPENSE' | 'CASH_RETURN';

  @IsOptional()
  @IsUUID()
  glAccountId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsDateString()
  spentDate?: string;
}

export class ReviewImprestCaseDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveImprestCaseDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectImprestCaseDto {
  @IsString()
  reason!: string;
}

export class LinkImprestEvidenceDto {
  @IsUUID()
  evidenceId!: string;

  @IsIn([
    'REQUEST_SUPPORTING_DOC',
    'FUNDING_PROOF',
    'RECEIPT_BUNDLE',
    'CASH_RETURN_PROOF',
    'OTHER',
  ] as const)
  type!:
    | 'REQUEST_SUPPORTING_DOC'
    | 'FUNDING_PROOF'
    | 'RECEIPT_BUNDLE'
    | 'CASH_RETURN_PROOF'
    | 'OTHER';
}

export class IssueImprestCaseDto {
  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SettleImprestCaseDto {
  @IsOptional()
  @IsDateString()
  settlementDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

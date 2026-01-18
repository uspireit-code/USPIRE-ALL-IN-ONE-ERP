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

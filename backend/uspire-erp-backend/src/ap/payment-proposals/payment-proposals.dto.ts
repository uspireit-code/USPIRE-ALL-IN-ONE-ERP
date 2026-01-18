import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListPaymentProposalsQueryDto {
  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED';

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CreatePaymentProposalLineDto {
  @IsUUID()
  invoiceId!: string;

  @Min(0.01)
  proposedPayAmount!: number;
}

export class CreatePaymentProposalDto {
  @IsOptional()
  @IsDateString()
  proposalDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentProposalLineDto)
  lines!: CreatePaymentProposalLineDto[];
}

export class EligibleApInvoicesQueryDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class RejectPaymentProposalDto {
  @IsString()
  reason!: string;
}

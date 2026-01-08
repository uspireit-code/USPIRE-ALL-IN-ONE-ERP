import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerCreditNoteLineDto {
  @IsString()
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  quantity?: number;

  @Type(() => Number)
  @Min(0)
  unitPrice!: number;

  @IsUUID()
  revenueAccountId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  fundId?: string;
}

export class CreateCustomerCreditNoteDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsDateString()
  creditNoteDate!: string;

  @IsString()
  currency!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerCreditNoteLineDto)
  lines!: CreateCustomerCreditNoteLineDto[];
}

export class ListCreditNotesQueryDto {
  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'APPROVED' | 'POSTED' | 'VOID';

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pageSize?: number;
}

export class ApproveCreditNoteDto {
  @IsOptional()
  @IsString()
  memo?: string;
}

export class PostCreditNoteDto {
}

export class VoidCreditNoteDto {
  @IsString()
  reason!: string;
}

import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerInvoiceLineDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  taxRateId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  fundId?: string;

  @IsString()
  description!: string;

  @IsOptional()
  @Min(0)
  quantity?: number;

  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  discountAmount?: number;
}

export class CreateCustomerInvoiceDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsString()
  currency!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  exchangeRate?: number;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  invoiceNote?: string;

  @IsOptional()
  @IsUUID()
  invoiceCategoryId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  fundId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerInvoiceLineDto)
  lines!: CreateCustomerInvoiceLineDto[];
}

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'POSTED';

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  pageSize?: number;
}

export class PostInvoiceDto {
}

export class ConfirmInvoicesImportDto {
  @IsString()
  importId!: string;
}

export class BulkPostInvoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  invoiceIds!: string[];
}

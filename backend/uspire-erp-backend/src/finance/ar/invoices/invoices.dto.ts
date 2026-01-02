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

export class CreateCustomerInvoiceLineDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @Min(0)
  quantity?: number;

  @Min(0)
  unitPrice!: number;
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
  @IsString()
  reference?: string;

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
  @IsOptional()
  @IsString()
  arControlAccountCode?: string;
}

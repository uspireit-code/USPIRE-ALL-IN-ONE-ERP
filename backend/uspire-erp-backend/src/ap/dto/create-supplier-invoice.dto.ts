import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceTaxLineDto } from './invoice-tax-line.dto';

export class CreateSupplierInvoiceLineDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  description!: string;

  @Min(0)
  amount!: number;
}

export class CreateSupplierInvoiceDto {
  @IsNotEmpty({ message: 'Supplier is required.' })
  @IsUUID()
  supplierId!: string;

  @IsNotEmpty({ message: 'Bill date is required.' })
  @IsDateString()
  invoiceDate!: string;

  @IsNotEmpty({ message: 'Due date is required.' })
  @IsDateString()
  dueDate!: string;

  @Min(0)
  totalAmount!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierInvoiceLineDto)
  lines!: CreateSupplierInvoiceLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceTaxLineDto)
  taxLines?: InvoiceTaxLineDto[];

  @IsOptional()
  @IsString()
  apControlAccountCode?: string;
}

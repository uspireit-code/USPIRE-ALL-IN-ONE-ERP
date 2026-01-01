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
import { InvoiceTaxLineDto } from './invoice-tax-line.dto';

export class CreateCustomerInvoiceLineDto {
  @IsUUID()
  accountId!: string;

  @IsString()
  description!: string;

  @Min(0)
  amount!: number;
}

export class CreateCustomerInvoiceDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  invoiceNumber!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsDateString()
  dueDate!: string;

  @Min(0)
  totalAmount!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCustomerInvoiceLineDto)
  lines!: CreateCustomerInvoiceLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceTaxLineDto)
  taxLines?: InvoiceTaxLineDto[];

  @IsOptional()
  @IsString()
  arControlAccountCode?: string;
}

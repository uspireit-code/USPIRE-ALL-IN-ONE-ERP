import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReceiptLineDto } from './receipt-line.dto';

const PAYMENT_METHODS = ['CASH', 'CARD', 'EFT', 'CHEQUE', 'OTHER'] as const;

export class CreateReceiptDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  receiptDate!: string;

  @IsString()
  currency!: string;

  @Min(0)
  totalAmount!: number;

  @IsIn(PAYMENT_METHODS)
  paymentMethod!: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines?: ReceiptLineDto[];
}

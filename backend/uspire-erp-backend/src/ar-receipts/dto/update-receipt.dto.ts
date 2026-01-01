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

export class UpdateReceiptDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Min(0)
  totalAmount?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];

  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines?: ReceiptLineDto[];
}

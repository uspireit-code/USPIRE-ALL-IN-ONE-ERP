import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const REFUND_PAYMENT_METHODS = ['BANK', 'CASH'] as const;

export class CreateCustomerRefundDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  creditNoteId!: string;

  @IsDateString()
  refundDate!: string;

  @IsString()
  currency!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0.000001)
  exchangeRate?: number;

  @Type(() => Number)
  @Min(0.01)
  amount!: number;

  @IsIn(REFUND_PAYMENT_METHODS)
  paymentMethod!: (typeof REFUND_PAYMENT_METHODS)[number];

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;
}

export class ApproveRefundDto {
}

export class PostRefundDto {
}

export class VoidRefundDto {
  @IsString()
  reason!: string;
}

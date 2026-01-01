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

export class CreatePaymentAllocationDto {
  @IsString()
  sourceType!: 'SUPPLIER_INVOICE' | 'CUSTOMER_INVOICE';

  @IsUUID()
  sourceId!: string;

  @Min(0)
  amount!: number;
}

export class CreatePaymentDto {
  @IsString()
  type!: 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT';

  @IsUUID()
  bankAccountId!: string;

  @Min(0)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations!: CreatePaymentAllocationDto[];

  @IsOptional()
  @IsString()
  apControlAccountCode?: string;

  @IsOptional()
  @IsString()
  arControlAccountCode?: string;
}

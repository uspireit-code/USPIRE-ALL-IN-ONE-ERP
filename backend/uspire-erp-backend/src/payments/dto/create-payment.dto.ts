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
  sourceType!: 'SUPPLIER_INVOICE' | 'SUPPLIER_ADVANCE' | 'CUSTOMER_INVOICE';

  @IsUUID()
  sourceId!: string;

  @Min(0)
  amount!: number;

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations?: CreatePaymentAllocationDto[];

  @IsOptional()
  @IsString()
  apControlAccountCode?: string;
}

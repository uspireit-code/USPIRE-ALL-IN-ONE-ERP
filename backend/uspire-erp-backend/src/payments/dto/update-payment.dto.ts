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

export class UpdatePaymentAllocationDto {
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

export class UpdatePaymentDto {
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
  @Type(() => UpdatePaymentAllocationDto)
  allocations?: UpdatePaymentAllocationDto[];
}

import { IsIn, IsOptional, IsString, Min } from 'class-validator';

const CUSTOMER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export class ListCustomersQueryDto {
  @IsOptional()
  @Min(1)
  page?: number;

  @IsOptional()
  @Min(1)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;
}

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  customerCode?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;
}

import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInvoiceCategoryDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsUUID()
  revenueAccountId!: string;

  @IsOptional()
  @IsBoolean()
  requiresProject?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresFund?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDepartment?: boolean;
}

export class UpdateInvoiceCategoryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  revenueAccountId?: string;

  @IsOptional()
  @IsBoolean()
  requiresProject?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresFund?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresDepartment?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

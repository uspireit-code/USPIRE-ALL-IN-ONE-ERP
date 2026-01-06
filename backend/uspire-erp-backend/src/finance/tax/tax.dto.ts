import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateTaxRateDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @Min(0)
  @Max(100)
  rate!: number;

  @IsIn(['OUTPUT', 'INPUT'])
  type!: 'OUTPUT' | 'INPUT';

  @IsOptional()
  @IsUUID()
  glAccountId?: string;
}

export class UpdateTaxRateDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Min(0)
  @Max(100)
  rate?: number;

  @IsOptional()
  @IsIn(['OUTPUT', 'INPUT'])
  type?: 'OUTPUT' | 'INPUT';

  @IsOptional()
  @IsUUID()
  glAccountId?: string | null;
}

export class SetTaxRateActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateTenantTaxConfigDto {
  @IsOptional()
  @IsUUID()
  outputVatAccountId?: string | null;

  @IsOptional()
  @IsUUID()
  inputVatAccountId?: string | null;
}

export class TaxSummaryQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

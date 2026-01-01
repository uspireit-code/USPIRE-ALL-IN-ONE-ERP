import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export enum DepreciationMethodDto {
  STRAIGHT_LINE = 'STRAIGHT_LINE',
}

export class CreateFixedAssetDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  acquisitionDate!: string;

  @IsString()
  cost!: string;

  @IsString()
  residualValue!: string;

  @IsInt()
  @Min(1)
  usefulLifeMonths!: number;

  @IsEnum(DepreciationMethodDto)
  method!: DepreciationMethodDto;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  apInvoiceId?: string;
}

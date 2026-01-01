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

export class CreateFixedAssetCategoryDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(DepreciationMethodDto)
  defaultMethod!: DepreciationMethodDto;

  @IsInt()
  @Min(1)
  defaultUsefulLifeMonths!: number;

  @IsOptional()
  @IsString()
  defaultResidualRate?: string;

  @IsString()
  @MinLength(1)
  assetAccountId!: string;

  @IsString()
  @MinLength(1)
  accumDepAccountId!: string;

  @IsString()
  @MinLength(1)
  depExpenseAccountId!: string;
}

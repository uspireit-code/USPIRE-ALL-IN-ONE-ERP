import { IsOptional, IsString, MinLength } from 'class-validator';

export class CapitalizeFixedAssetDto {
  @IsString()
  capitalizationDate!: string;

  @IsString()
  @MinLength(1)
  assetAccountId!: string;

  @IsString()
  @MinLength(1)
  accumDepAccountId!: string;

  @IsString()
  @MinLength(1)
  depExpenseAccountId!: string;

  @IsString()
  @MinLength(1)
  clearingAccountId!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

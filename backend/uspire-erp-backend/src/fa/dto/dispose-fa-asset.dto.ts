import { IsOptional, IsString, MinLength } from 'class-validator';

export class DisposeFixedAssetDto {
  @IsString()
  disposalDate!: string;

  @IsString()
  proceeds!: string;

  @IsString()
  @MinLength(1)
  proceedsAccountId!: string;

  @IsString()
  @MinLength(1)
  gainLossAccountId!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

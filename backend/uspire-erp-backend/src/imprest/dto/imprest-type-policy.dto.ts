import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateImprestTypePolicyDto {
  @IsString()
  name!: string;

  @IsString()
  defaultFloatLimit!: string;

  @IsInt()
  @Min(1)
  settlementDays!: number;

  @IsString()
  receiptRule!: string;

  @IsOptional()
  @IsString()
  receiptThresholdAmount?: string;

  @IsString()
  approvalStrength!: string;

  @IsString()
  defaultRiskRating!: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateImprestTypePolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  defaultFloatLimit?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  settlementDays?: number;

  @IsOptional()
  @IsString()
  receiptRule?: string;

  @IsOptional()
  @IsString()
  receiptThresholdAmount?: string;

  @IsOptional()
  @IsString()
  approvalStrength?: string;

  @IsOptional()
  @IsString()
  defaultRiskRating?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

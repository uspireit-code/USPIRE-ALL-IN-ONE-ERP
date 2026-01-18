import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateImprestFacilityDto {
  @IsUUID()
  typePolicyId!: string;

  @IsUUID()
  custodianUserId!: string;

  @IsUUID()
  entityId!: string;

  @IsUUID()
  departmentId!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  fundId?: string;

  @IsString()
  currency!: string;

  @IsString()
  approvedFloatLimit!: string;

  @IsInt()
  @Min(1)
  settlementDays!: number;

  @IsIn(['BANK', 'CASH', 'MOBILE_MONEY'] as const)
  fundingSourceType!: 'BANK' | 'CASH' | 'MOBILE_MONEY';

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'] as const)
  riskRating!: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsUUID()
  controlGlAccountId!: string;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validTo!: string;
}

export class UpdateImprestFacilityDto {
  @IsOptional()
  @IsUUID()
  custodianUserId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  fundId?: string;

  @IsOptional()
  @IsString()
  approvedFloatLimit?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  settlementDays?: number;

  @IsOptional()
  @IsIn(['BANK', 'CASH', 'MOBILE_MONEY'] as const)
  fundingSourceType?: 'BANK' | 'CASH' | 'MOBILE_MONEY';

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH'] as const)
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH';

  @IsOptional()
  @IsUUID()
  controlGlAccountId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'CLOSED'] as const)
  status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
}

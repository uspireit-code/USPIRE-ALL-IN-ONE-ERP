import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const OUTCOMES = ['BLOCKED', 'FAILED'] as const;

const CATEGORIES = ['SOD', 'LIFECYCLE', 'IMMUTABILITY', 'OVERRIDE', 'EVIDENCE', 'AUTOMATION'] as const;

export class GovernanceExceptionRegisterQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(CATEGORIES as unknown as string[])
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsIn(OUTCOMES as unknown as string[])
  outcome?: (typeof OUTCOMES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

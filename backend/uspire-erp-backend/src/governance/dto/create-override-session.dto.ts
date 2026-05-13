import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOverrideSessionDto {
  @IsString()
  @MinLength(3)
  overrideCode!: string;

  @IsString()
  @MinLength(3)
  entryPoint!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsString()
  @MinLength(3)
  justification!: string;

  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  @IsString()
  escalationType?: string | null;

  @IsOptional()
  @IsString()
  escalationReason?: string | null;

  @IsOptional()
  @IsString()
  entityType?: string | null;

  @IsOptional()
  @IsString()
  entityId?: string | null;
}

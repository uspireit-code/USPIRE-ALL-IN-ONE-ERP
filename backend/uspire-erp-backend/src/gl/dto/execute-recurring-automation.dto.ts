import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AutomationEvidenceRefDto {
  @IsString()
  id!: string;

  @IsOptional()
  @IsString()
  evidenceCategory?: string | null;

  @IsOptional()
  @IsString()
  fileName?: string | null;
}

export class ExecuteRecurringAutomationDto {
  @IsOptional()
  @IsDateString()
  runDate?: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsOptional()
  @IsBoolean()
  autoSubmitForReview?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AutomationEvidenceRefDto)
  evidenceRefs?: AutomationEvidenceRefDto[];

  @IsOptional()
  @IsString()
  overrideSessionId?: string;

  @IsOptional()
  @IsString()
  governanceReason?: string;
}

import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationEvidenceRefDto } from './execute-recurring-automation.dto';

export class ExecuteReversalAutomationDto {
  @IsOptional()
  @IsDateString()
  journalDate?: string;

  @IsOptional()
  @IsString()
  scheduleId?: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

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

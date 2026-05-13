import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class ExecuteAutomationScheduleDto {
  @IsOptional()
  @IsDateString()
  runAt?: string;

  @IsOptional()
  @IsBoolean()
  autoSubmitForReview?: boolean;

  @IsOptional()
  evidenceRefs?: Array<{ id: string; evidenceCategory?: string | null; fileName?: string | null }>;

  @IsOptional()
  @IsString()
  overrideSessionId?: string;

  @IsOptional()
  @IsString()
  governanceReason?: string;
}

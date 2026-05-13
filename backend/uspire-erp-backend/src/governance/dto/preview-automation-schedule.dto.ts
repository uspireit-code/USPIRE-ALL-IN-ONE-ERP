import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PreviewAutomationScheduleDto {
  @IsString()
  automationCode!: string;

  @IsString()
  targetType!: string;

  @IsString()
  targetId!: string;

  @IsOptional()
  scheduleConfig?: any;

  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsDateString()
  now?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number;
}

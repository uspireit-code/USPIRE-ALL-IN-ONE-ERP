import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAutomationScheduleDto {
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
}

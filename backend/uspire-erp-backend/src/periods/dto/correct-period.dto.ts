import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CorrectPeriodDto {
  @IsOptional()
  @IsDateString()
  newStartDate?: string;

  @IsOptional()
  @IsDateString()
  newEndDate?: string;

  @IsString()
  @MinLength(3)
  reason!: string;
}

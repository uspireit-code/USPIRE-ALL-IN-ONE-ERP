import { IsDateString, IsOptional } from 'class-validator';

export class GenerateRecurringTemplateDto {
  @IsOptional()
  @IsDateString()
  runDate?: string;
}

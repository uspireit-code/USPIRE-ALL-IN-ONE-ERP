import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReverseJournalDto {
  @IsOptional()
  @IsDateString()
  journalDate?: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

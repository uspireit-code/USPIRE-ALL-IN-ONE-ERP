import { IsOptional, IsString, MinLength } from 'class-validator';

export class VoidJournalDto {
  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

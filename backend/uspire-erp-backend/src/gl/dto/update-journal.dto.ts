import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateJournalLineDto {
  @IsOptional()
  @Min(1)
  lineNumber?: number;

  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  legalEntityId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  fundId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  budgetOverrideJustification?: string;

  @Min(0)
  debit!: number;

  @Min(0)
  credit!: number;
}

export class UpdateJournalDto {
  @IsDateString()
  journalDate!: string;

  @IsOptional()
  @IsEnum(['STANDARD', 'ADJUSTING', 'ACCRUAL', 'REVERSING'] as const)
  journalType?: 'STANDARD' | 'ADJUSTING' | 'ACCRUAL' | 'REVERSING';

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => UpdateJournalLineDto)
  lines!: UpdateJournalLineDto[];
}

import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRecurringTemplateLineDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsString()
  descriptionTemplate?: string;

  @Min(0)
  debitAmount!: number;

  @Min(0)
  creditAmount!: number;

  @Min(1)
  lineOrder!: number;
}

export class UpdateRecurringTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['STANDARD'] as const)
  journalType?: 'STANDARD';

  @IsOptional()
  @IsString()
  referenceTemplate?: string;

  @IsOptional()
  @IsString()
  descriptionTemplate?: string;

  @IsOptional()
  @IsEnum(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const)
  frequency?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsDateString()
  nextRunDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => UpdateRecurringTemplateLineDto)
  lines?: UpdateRecurringTemplateLineDto[];
}

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

export class CreateRecurringTemplateLineDto {
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

export class CreateRecurringTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(['STANDARD'] as const)
  journalType?: 'STANDARD';

  @IsString()
  referenceTemplate!: string;

  @IsOptional()
  @IsString()
  descriptionTemplate?: string;

  @IsEnum(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const)
  frequency!: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsDateString()
  nextRunDate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateRecurringTemplateLineDto)
  lines!: CreateRecurringTemplateLineDto[];
}

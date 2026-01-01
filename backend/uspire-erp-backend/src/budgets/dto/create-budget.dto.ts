import {
  IsArray,
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBudgetLineDto {
  @IsString()
  accountId!: string;

  @IsString()
  periodId!: string;

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

  @IsNumber()
  amount!: number;
}

export class CreateBudgetDto {
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  lines!: CreateBudgetLineDto[];
}

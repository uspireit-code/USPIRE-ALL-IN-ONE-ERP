import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BankStatementLineInputDto {
  @IsDateString()
  transactionDate!: string;

  @IsString()
  description!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class AddBankStatementLinesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BankStatementLineInputDto)
  lines!: BankStatementLineInputDto[];
}

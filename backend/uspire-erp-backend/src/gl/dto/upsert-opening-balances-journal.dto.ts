import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertOpeningBalancesJournalLineDto {
  @IsUUID()
  accountId!: string;

  @Min(0)
  debit!: number;

  @Min(0)
  credit!: number;
}

export class UpsertOpeningBalancesJournalDto {
  @IsDateString()
  cutoverDate!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => UpsertOpeningBalancesJournalLineDto)
  lines!: UpsertOpeningBalancesJournalLineDto[];
}

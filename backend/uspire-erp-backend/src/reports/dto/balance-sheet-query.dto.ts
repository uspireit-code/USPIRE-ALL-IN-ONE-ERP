import { IsDateString } from 'class-validator';

export class BalanceSheetQueryDto {
  @IsDateString()
  asOf!: string;
}

import { IsDateString } from 'class-validator';

export class OpeningBalancesQueryDto {
  @IsDateString()
  cutoverDate!: string;
}

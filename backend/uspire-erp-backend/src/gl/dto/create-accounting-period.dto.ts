import { IsDateString, IsString } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsString()
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

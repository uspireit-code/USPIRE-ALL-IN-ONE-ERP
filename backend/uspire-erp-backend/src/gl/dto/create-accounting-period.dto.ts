import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsString()
  @MinLength(3)
  code!: string;

  @IsString()
  @IsOptional()
  name!: string;

  @IsIn(['OPENING', 'NORMAL'])
  type!: 'OPENING' | 'NORMAL';

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

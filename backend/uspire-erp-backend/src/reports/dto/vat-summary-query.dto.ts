import { IsDateString } from 'class-validator';

export class VatSummaryQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

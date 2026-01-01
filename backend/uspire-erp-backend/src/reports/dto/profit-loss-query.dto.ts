import { IsDateString } from 'class-validator';

export class ProfitLossQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

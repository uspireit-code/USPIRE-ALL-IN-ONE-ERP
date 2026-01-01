import { IsDateString } from 'class-validator';

export class PnlQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

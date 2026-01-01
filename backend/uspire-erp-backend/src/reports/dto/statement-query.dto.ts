import { IsDateString } from 'class-validator';

export class StatementQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

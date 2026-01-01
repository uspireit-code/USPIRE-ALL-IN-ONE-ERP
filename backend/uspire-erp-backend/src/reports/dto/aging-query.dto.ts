import { IsDateString } from 'class-validator';

export class AgingQueryDto {
  @IsDateString()
  asOf!: string;
}

import { IsDateString } from 'class-validator';

export class SoceQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

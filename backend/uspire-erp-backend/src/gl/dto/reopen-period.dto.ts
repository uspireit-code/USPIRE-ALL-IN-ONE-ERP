import { IsString, MinLength } from 'class-validator';

export class ReopenPeriodDto {
  @IsString()
  @MinLength(3)
  reason!: string;
}

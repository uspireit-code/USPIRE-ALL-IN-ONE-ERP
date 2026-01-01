import { IsString, MinLength } from 'class-validator';

export class RunDepreciationDto {
  @IsString()
  @MinLength(1)
  periodId!: string;
}

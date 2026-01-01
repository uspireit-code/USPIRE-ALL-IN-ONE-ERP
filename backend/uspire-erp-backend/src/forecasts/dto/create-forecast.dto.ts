import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateForecastLineDto {
  @IsString()
  accountId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsNumber()
  amount!: number;
}

export class CreateForecastDto {
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateForecastLineDto)
  lines!: CreateForecastLineDto[];
}

import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateForecastLineDto } from './create-forecast.dto';

export class UpdateForecastLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateForecastLineDto)
  lines!: CreateForecastLineDto[];
}

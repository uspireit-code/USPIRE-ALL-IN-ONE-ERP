import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ApAgingQueryDto {
  @IsOptional()
  @IsDateString()
  asOfDate?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

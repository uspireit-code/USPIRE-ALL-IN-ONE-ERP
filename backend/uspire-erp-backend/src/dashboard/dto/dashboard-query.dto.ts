import { IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsISO8601()
  asOf?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  fiscalYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

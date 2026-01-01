import { IsIn, IsOptional } from 'class-validator';

export class ReportCompareQueryDto {
  @IsOptional()
  @IsIn(['prior_month', 'prior_year'])
  compare?: 'prior_month' | 'prior_year';
}

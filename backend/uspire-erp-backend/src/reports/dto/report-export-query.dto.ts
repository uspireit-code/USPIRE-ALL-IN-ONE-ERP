import { IsIn, IsOptional } from 'class-validator';

export class ReportExportQueryDto {
  @IsIn(['pdf', 'csv', 'xlsx'])
  format!: 'pdf' | 'csv' | 'xlsx';

  @IsOptional()
  compare?: 'prior_month' | 'prior_year';
}

import { IsIn, IsOptional } from 'class-validator';

export class ApBillExportDto {
  @IsOptional()
  @IsIn(['pdf'])
  format?: 'pdf';
}

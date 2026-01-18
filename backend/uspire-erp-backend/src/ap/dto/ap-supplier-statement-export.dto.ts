import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ApSupplierStatementExportDto {
  @IsUUID()
  supplierId!: string;

  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsIn(['pdf', 'excel'])
  format?: 'pdf' | 'excel';
}

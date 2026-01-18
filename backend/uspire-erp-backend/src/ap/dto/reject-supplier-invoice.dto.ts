import { IsString } from 'class-validator';

export class RejectSupplierInvoiceDto {
  @IsString()
  reason!: string;
}

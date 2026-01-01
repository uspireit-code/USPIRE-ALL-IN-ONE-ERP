import { IsOptional, IsString } from 'class-validator';

export class PostCustomerInvoiceDto {
  @IsOptional()
  @IsString()
  arControlAccountCode?: string;
}

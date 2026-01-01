import { IsOptional, IsString } from 'class-validator';

export class PostInvoiceDto {
  @IsOptional()
  @IsString()
  apControlAccountCode?: string;
}

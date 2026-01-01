import { IsUUID, Min } from 'class-validator';

export class ReceiptLineDto {
  @IsUUID()
  invoiceId!: string;

  @Min(0)
  appliedAmount!: number;
}

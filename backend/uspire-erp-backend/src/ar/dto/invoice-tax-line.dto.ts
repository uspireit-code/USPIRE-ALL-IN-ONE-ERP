import { IsUUID, Min } from 'class-validator';

export class InvoiceTaxLineDto {
  @IsUUID()
  taxRateId!: string;

  @Min(0)
  taxableAmount!: number;

  @Min(0)
  taxAmount!: number;
}

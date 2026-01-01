import { IsUUID } from 'class-validator';

export class MatchBankReconciliationDto {
  @IsUUID()
  paymentId!: string;

  @IsUUID()
  statementLineId!: string;
}

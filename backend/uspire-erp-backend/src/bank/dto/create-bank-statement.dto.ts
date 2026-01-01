import { IsDateString, IsNumber, IsUUID } from 'class-validator';

export class CreateBankStatementDto {
  @IsUUID()
  bankAccountId!: string;

  @IsDateString()
  statementDate!: string;

  @IsNumber()
  openingBalance!: number;

  @IsNumber()
  closingBalance!: number;
}

import { IsUUID } from 'class-validator';

export class ListBankStatementsQueryDto {
  @IsUUID()
  bankAccountId!: string;
}

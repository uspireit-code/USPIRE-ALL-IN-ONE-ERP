import { IsUUID } from 'class-validator';

export class ReconciliationStatusQueryDto {
  @IsUUID()
  bankAccountId!: string;
}

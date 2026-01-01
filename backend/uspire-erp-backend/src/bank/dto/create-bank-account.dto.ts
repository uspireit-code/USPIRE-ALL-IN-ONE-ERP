import { IsString, IsUUID } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  name!: string;

  @IsString()
  bankName!: string;

  @IsString()
  accountNumber!: string;

  @IsString()
  currency!: string;

  @IsUUID()
  glAccountId!: string;
}

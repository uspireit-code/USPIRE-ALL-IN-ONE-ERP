import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateSupplierBankAccountDto {
  @IsString()
  bankName!: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsString()
  accountName!: string;

  @IsString()
  accountNumber!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  swiftCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

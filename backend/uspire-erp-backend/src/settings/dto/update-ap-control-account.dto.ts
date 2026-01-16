import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

function isNotNull(_: any, value: any) {
  return value !== null;
}

export class UpdateApControlAccountDto {
  @IsOptional()
  @ValidateIf(isNotNull)
  @IsUUID()
  apControlAccountId?: string | null;
}

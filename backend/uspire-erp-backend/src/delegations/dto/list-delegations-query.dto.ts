import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';

export class ListDelegationsQueryDto {
  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;

  @IsOptional()
  @IsBooleanString()
  includeExpired?: string;

  @IsOptional()
  @IsUUID()
  delegatorUserId?: string;

  @IsOptional()
  @IsUUID()
  delegateUserId?: string;
}

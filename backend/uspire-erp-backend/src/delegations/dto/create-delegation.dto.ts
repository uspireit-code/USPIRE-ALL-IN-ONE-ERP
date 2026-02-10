import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DelegationScope } from '@prisma/client';

export class CreateDelegationDto {
  @IsUUID()
  delegatorUserId!: string;

  @IsUUID()
  delegateUserId!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  expiresAt!: string;

  @IsEnum(DelegationScope)
  scope!: DelegationScope;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

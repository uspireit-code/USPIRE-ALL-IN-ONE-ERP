import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class TrialBalanceQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  entityId?: string;
}

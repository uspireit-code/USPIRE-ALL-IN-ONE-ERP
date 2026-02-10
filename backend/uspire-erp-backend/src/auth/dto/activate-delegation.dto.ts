import { IsString, MinLength } from 'class-validator';

export class ActivateDelegationDto {
  @IsString()
  @MinLength(1)
  delegationId!: string;
}

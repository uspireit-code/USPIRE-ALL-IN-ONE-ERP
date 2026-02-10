import { IsUUID } from 'class-validator';

export class ResolveUnlockRequestDto {
  @IsUUID()
  unlockRequestId: string;
}

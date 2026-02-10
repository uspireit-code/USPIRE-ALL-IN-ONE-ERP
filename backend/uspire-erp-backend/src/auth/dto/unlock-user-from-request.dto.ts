import { IsUUID } from 'class-validator';

export class UnlockUserFromRequestDto {
  @IsUUID()
  unlockRequestId: string;
}

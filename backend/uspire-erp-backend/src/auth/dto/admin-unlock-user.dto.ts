import { IsString, IsUUID } from 'class-validator';

export class AdminUnlockUserDto {
  @IsString()
  @IsUUID()
  userId!: string;
}

import { IsString, MinLength } from 'class-validator';

export class Verify2faDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;

  @IsString()
  @MinLength(4)
  otp!: string;
}

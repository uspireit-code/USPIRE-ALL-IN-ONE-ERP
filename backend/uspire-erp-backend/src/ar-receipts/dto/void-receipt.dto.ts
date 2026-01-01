import { IsString, MinLength } from 'class-validator';

export class VoidReceiptDto {
  @IsString()
  @MinLength(2)
  reason!: string;
}
